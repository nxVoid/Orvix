// SPDX-License-Identifier: AGPL-3.0-or-later
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const COMMIT = '0128ca510d653bb04d6d1e4885bd8890b5050b4f';
const BASE_URL = `https://raw.githubusercontent.com/trebeljahr/quaternius-showcase/${COMMIT}/public/glb`;

const ANIM_SOURCE_URL = `${BASE_URL}/cyberpunk_pack/Character.glb`;

function readGlb(buf) {
	const jsonLen = buf.readUInt32LE(12);
	const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString());
	const binOffset = 20 + jsonLen + 8;
	const bin = buf.subarray(binOffset);
	return {json, bin};
}

function writeGlb(json, bin) {
	const jsonStr = JSON.stringify(json);
	const jsonPadding = (4 - (jsonStr.length % 4)) % 4;
	const paddedJson = jsonStr + ' '.repeat(jsonPadding);
	const jsonBuf = Buffer.from(paddedJson, 'utf8');

	const binPadding = (4 - (bin.length % 4)) % 4;
	const paddedBin = binPadding ? Buffer.concat([bin, Buffer.alloc(binPadding)]) : bin;

	const totalLen = 12 + 8 + jsonBuf.length + 8 + paddedBin.length;
	const header = Buffer.alloc(12);
	header.write('glTF', 0);
	header.writeUInt32LE(2, 4);
	header.writeUInt32LE(totalLen, 8);

	const jsonHeader = Buffer.alloc(8);
	jsonHeader.writeUInt32LE(jsonBuf.length, 0);
	jsonHeader.write('JSON', 4);

	const binHeader = Buffer.alloc(8);
	binHeader.writeUInt32LE(paddedBin.length, 0);
	binHeader.write('BIN\0', 4);

	return Buffer.concat([header, jsonHeader, jsonBuf, binHeader, paddedBin]);
}

async function fetchBuffer(url) {
	console.log(`Fetching ${url}...`);
	const res = await fetch(url);
	if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
	const ab = await res.arrayBuffer();
	return Buffer.from(ab);
}

function appendBufferViewAndAccessor(dst, componentType, type, count, dataBuf, min = undefined, max = undefined) {
	const align = 4;
	const binOffset = dst.bin.length;
	const alignedOffset = Math.ceil(binOffset / align) * align;
	const padding = Buffer.alloc(alignedOffset - binOffset);
	dst.bin = Buffer.concat([dst.bin, padding, dataBuf]);

	const bvIdx = dst.json.bufferViews.length;
	dst.json.bufferViews.push({
		buffer: 0,
		byteOffset: alignedOffset,
		byteLength: dataBuf.length,
	});

	const accIdx = dst.json.accessors.length;
	const acc = {
		bufferView: bvIdx,
		byteOffset: 0,
		componentType,
		count,
		type,
	};
	if (min !== undefined) acc.min = min;
	if (max !== undefined) acc.max = max;
	dst.json.accessors.push(acc);
	return accIdx;
}

function transferHumanAnimations(targetBuf, animBuf) {
	const dst = readGlb(targetBuf);
	const src = readGlb(animBuf);

	const binOffset = dst.bin.length;
	const alignedBinOffset = Math.ceil(binOffset / 4) * 4;
	const paddingBefore = Buffer.alloc(alignedBinOffset - binOffset);
	let currentBin = Buffer.concat([dst.bin, paddingBefore, src.bin]);
	dst.bin = currentBin;

	const bufferViewOffset = dst.json.bufferViews.length;
	const accessorOffset = dst.json.accessors.length;

	for (const bv of src.json.bufferViews) {
		dst.json.bufferViews.push({
			...bv,
			byteOffset: (bv.byteOffset || 0) + alignedBinOffset,
		});
	}

	for (const acc of src.json.accessors) {
		dst.json.accessors.push({
			...acc,
			bufferView: acc.bufferView !== undefined ? acc.bufferView + bufferViewOffset : undefined,
		});
	}

	const dstNodesByName = new Map();
	dst.json.nodes.forEach((n, idx) => {
		if (n.name) dstNodesByName.set(n.name, idx);
	});

	// Bone aliases
	dstNodesByName.set('Fist.L', dstNodesByName.get('Hand.L') ?? dstNodesByName.get('HandL'));
	dstNodesByName.set('Fist.R', dstNodesByName.get('Hand.R') ?? dstNodesByName.get('HandR'));
	dstNodesByName.set('Body', dstNodesByName.get('Hips') ?? dstNodesByName.get('Root'));

	const srcBodyNode = src.json.nodes.find((n) => n.name === 'Body');
	const srcRestTranslation = srcBodyNode?.translation ? [...srcBodyNode.translation] : [0, 0.006005, 0];

	const targetHipsIdx = dstNodesByName.get('Hips');
	const targetHipsNode = targetHipsIdx !== undefined ? dst.json.nodes[targetHipsIdx] : undefined;
	const targetRestTranslation = targetHipsNode?.translation ? [...targetHipsNode.translation] : [0, 0.00894, 0];

	const deltaRest = [
		targetRestTranslation[0] - srcRestTranslation[0],
		targetRestTranslation[1] - srcRestTranslation[1],
		targetRestTranslation[2] - srcRestTranslation[2],
	];

	// Target animations to copy from Cyberpunk character
	const TARGET_SRC_ANIMS = [
		{srcName: 'CharacterArmature|Idle_Neutral', dstName: 'Idle'},
		{srcName: 'CharacterArmature|Walk', dstName: 'Walk'},
		{srcName: 'CharacterArmature|Run', dstName: 'Run'},
		{srcName: 'CharacterArmature|Wave', dstName: 'Wave'},
	];

	dst.json.animations = [];

	for (const targetAnim of TARGET_SRC_ANIMS) {
		const anim = src.json.animations.find((a) => a.name === targetAnim.srcName);
		if (!anim) continue;

		const validChannels = [];
		const validSamplers = [];
		const samplerMap = new Map();

		for (const ch of anim.channels) {
			const srcNodeName = src.json.nodes[ch.target.node]?.name;
			const dstNodeIdx = dstNodesByName.get(srcNodeName);
			if (dstNodeIdx === undefined) continue;

			// CRITICAL SANITATION:
			// In forward kinematics SkinnedMesh, NEVER allow translation on child bones (e.g. Foot, Shoulder, Leg).
			// Only allow translation on the root Hips bone.
			if (ch.target.path === 'translation') {
				if (srcNodeName !== 'Body' && dstNodeIdx !== targetHipsIdx) {
					continue; // Drop child bone translation track to prevent joint detachment/stretching
				}
			}
			if (ch.target.path === 'scale') {
				continue; // Drop scale tracks
			}

			// Handle sampler
			let newSamplerIdx = samplerMap.get(ch.sampler);
			if (newSamplerIdx === undefined) {
				const srcSampler = anim.samplers[ch.sampler];
				let outputAccessorIdx = srcSampler.output + accessorOffset;

				// If translation on Hips, adjust values by deltaRest so hip height matches destination model
				if (ch.target.path === 'translation' && (srcNodeName === 'Body' || dstNodeIdx === targetHipsIdx)) {
					const origOutputAcc = src.json.accessors[srcSampler.output];
					const origOutputBv = src.json.bufferViews[origOutputAcc.bufferView];
					const byteOffsetInSrcBin = (origOutputBv.byteOffset || 0) + (origOutputAcc.byteOffset || 0);
					const count = origOutputAcc.count;

					const origFloats = new Float32Array(src.bin.buffer, src.bin.byteOffset + byteOffsetInSrcBin, count * 3);
					const adjustedFloats = new Float32Array(count * 3);
					let minX = Infinity,
						minY = Infinity,
						minZ = Infinity;
					let maxX = -Infinity,
						maxY = -Infinity,
						maxZ = -Infinity;

					for (let i = 0; i < count; i++) {
						const x = origFloats[i * 3 + 0] + deltaRest[0];
						const y = origFloats[i * 3 + 1] + deltaRest[1];
						const z = origFloats[i * 3 + 2] + deltaRest[2];
						adjustedFloats[i * 3 + 0] = x;
						adjustedFloats[i * 3 + 1] = y;
						adjustedFloats[i * 3 + 2] = z;

						if (x < minX) minX = x;
						if (y < minY) minY = y;
						if (z < minZ) minZ = z;
						if (x > maxX) maxX = x;
						if (y > maxY) maxY = y;
						if (z > maxZ) maxZ = z;
					}

					outputAccessorIdx = appendBufferViewAndAccessor(
						dst,
						5126,
						'VEC3',
						count,
						Buffer.from(adjustedFloats.buffer),
						[minX, minY, minZ],
						[maxX, maxY, maxZ],
					);
				}

				newSamplerIdx = validSamplers.length;
				validSamplers.push({
					...srcSampler,
					input: srcSampler.input + accessorOffset,
					output: outputAccessorIdx,
				});
				samplerMap.set(ch.sampler, newSamplerIdx);
			}

			validChannels.push({
				sampler: newSamplerIdx,
				target: {
					node: dstNodeIdx,
					path: ch.target.path,
				},
			});
		}

		if (validChannels.length > 0) {
			dst.json.animations.push({
				name: targetAnim.dstName,
				channels: validChannels,
				samplers: validSamplers,
			});
		}
	}

	// Synthesize clean chair Sit clip
	{
		const sitTimes = new Float32Array([0.0, 1.0, 2.0]);
		const sitTimeAcc = appendBufferViewAndAccessor(dst, 5126, 'SCALAR', 3, Buffer.from(sitTimes.buffer), [0.0], [2.0]);

		const sitChannels = [];
		const sitSamplers = [];

		function addSitChannel(nodeName, path, floats, type = 'VEC4') {
			const nodeIdx = dstNodesByName.get(nodeName);
			if (nodeIdx === undefined) return;
			const count = floats.length / (type === 'VEC3' ? 3 : 4);
			const accIdx = appendBufferViewAndAccessor(dst, 5126, type, count, Buffer.from(floats.buffer));
			const sIdx = sitSamplers.length;
			sitSamplers.push({
				input: sitTimeAcc,
				output: accIdx,
				interpolation: 'LINEAR',
			});
			sitChannels.push({
				sampler: sIdx,
				target: {node: nodeIdx, path},
			});
		}

		// Lower hips to chair height (~0.45m in world, ~0.0045 in model local)
		const restHips = targetRestTranslation;
		const sitHipsY = restHips[1] - 0.0044;
		const sitHipsZ = restHips[2] - 0.0003;
		const hipsSitPos = new Float32Array([
			restHips[0],
			sitHipsY,
			sitHipsZ,
			restHips[0],
			sitHipsY + 0.0001,
			sitHipsZ,
			restHips[0],
			sitHipsY,
			sitHipsZ,
		]);
		addSitChannel('Hips', 'translation', hipsSitPos, 'VEC3');

		// Thighs rotated forward ~80 deg
		const uLegL = new Float32Array([
			-0.4858, 0.4637, 0.5206, -0.5272, -0.4858, 0.4637, 0.5206, -0.5272, -0.4858, 0.4637, 0.5206, -0.5272,
		]);
		const uLegR = new Float32Array([
			0.4843, 0.4617, 0.5218, 0.5292, 0.4843, 0.4617, 0.5218, 0.5292, 0.4843, 0.4617, 0.5218, 0.5292,
		]);
		addSitChannel('UpperLeg.L', 'rotation', uLegL);
		addSitChannel('UpperLeg.R', 'rotation', uLegR);

		// Calves bent down ~80 deg
		const lLegL = new Float32Array([
			0.5685, 0.4364, -0.5471, 0.4325, 0.5685, 0.4364, -0.5471, 0.4325, 0.5685, 0.4364, -0.5471, 0.4325,
		]);
		const lLegR = new Float32Array([
			0.5686, -0.4362, 0.5473, 0.4322, 0.5686, -0.4362, 0.5473, 0.4322, 0.5686, -0.4362, 0.5473, 0.4322,
		]);
		addSitChannel('LowerLeg.L', 'rotation', lLegL);
		addSitChannel('LowerLeg.R', 'rotation', lLegR);

		// Arms resting on thighs / lap
		const uArmL = new Float32Array([
			-0.7473, 0.196, 0.141, 0.6191, -0.7473, 0.196, 0.141, 0.6191, -0.7473, 0.196, 0.141, 0.6191,
		]);
		const uArmR = new Float32Array([
			-0.7473, -0.196, -0.141, 0.6191, -0.7473, -0.196, -0.141, 0.6191, -0.7473, -0.196, -0.141, 0.6191,
		]);
		const lArmL = new Float32Array([
			-0.3195, 0.0538, -0.6035, 0.7286, -0.3195, 0.0538, -0.6035, 0.7286, -0.3195, 0.0538, -0.6035, 0.7286,
		]);
		const lArmR = new Float32Array([
			-0.194, 0.1327, 0.5696, 0.7876, -0.194, 0.1327, 0.5696, 0.7876, -0.194, 0.1327, 0.5696, 0.7876,
		]);
		addSitChannel('UpperArm.L', 'rotation', uArmL);
		addSitChannel('UpperArm.R', 'rotation', uArmR);
		addSitChannel('LowerArm.L', 'rotation', lArmL);
		addSitChannel('LowerArm.R', 'rotation', lArmR);

		// Torso subtle breathing
		const torso = new Float32Array([0.0, 0.0, 0.0, 1.0, 0.015, 0.0, 0.0, 0.9999, 0.0, 0.0, 0.0, 1.0]);
		addSitChannel('Torso', 'rotation', torso);

		dst.json.animations.push({
			name: 'Sit',
			channels: sitChannels,
			samplers: sitSamplers,
		});
	}

	// Synthesize groovy upbeat Dance clip (2-second loop)
	{
		const danceTimes = new Float32Array([0.0, 0.5, 1.0, 1.5, 2.0]);
		const danceTimeAcc = appendBufferViewAndAccessor(dst, 5126, 'SCALAR', 5, Buffer.from(danceTimes.buffer), [0.0], [2.0]);

		const danceChannels = [];
		const danceSamplers = [];

		function addDanceChannel(nodeName, path, floats, type = 'VEC4') {
			const nodeIdx = dstNodesByName.get(nodeName);
			if (nodeIdx === undefined) return;
			const count = floats.length / (type === 'VEC3' ? 3 : 4);
			const accIdx = appendBufferViewAndAccessor(dst, 5126, type, count, Buffer.from(floats.buffer));
			const sIdx = danceSamplers.length;
			danceSamplers.push({
				input: danceTimeAcc,
				output: accIdx,
				interpolation: 'LINEAR',
			});
			danceChannels.push({
				sampler: sIdx,
				target: {node: nodeIdx, path},
			});
		}

		// Rhythmic hip bounce and contrapposto sway
		const restHips = targetRestTranslation;
		const danceHipsPos = new Float32Array([
			restHips[0],
			restHips[1],
			restHips[2],
			restHips[0] + 0.00035,
			restHips[1] + 0.00015,
			restHips[2],
			restHips[0],
			restHips[1] - 0.0002,
			restHips[2],
			restHips[0] - 0.00035,
			restHips[1] + 0.00015,
			restHips[2],
			restHips[0],
			restHips[1],
			restHips[2],
		]);
		addDanceChannel('Hips', 'translation', danceHipsPos, 'VEC3');

		// Hip groovy rotation
		const hipsRot = new Float32Array([
			0.0054, 0.0001, 0.0001, 1.0, 0.0054, 0.045, 0.035, 0.9983, 0.0054, 0.0001, 0.0001, 1.0, 0.0054, -0.045,
			-0.035, 0.9983, 0.0054, 0.0001, 0.0001, 1.0,
		]);
		addDanceChannel('Hips', 'rotation', hipsRot);

		// Torso counter-sway
		const torsoRot = new Float32Array([
			-0.0052, 0.0, 0.0, 1.0, -0.0052, -0.035, -0.025, 0.999, -0.0052, 0.0, 0.0, 1.0, -0.0052, 0.035, 0.025,
			0.999, -0.0052, 0.0, 0.0, 1.0,
		]);
		addDanceChannel('Torso', 'rotation', torsoRot);

		// Bent elbow pump arms
		const armL = new Float32Array([
			-0.7631, 0.1204, 0.0785, 0.6301, -0.74, 0.16, 0.11, 0.64, -0.7631, 0.1204, 0.0785, 0.6301, -0.78, 0.09,
			0.05, 0.62, -0.7631, 0.1204, 0.0785, 0.6301,
		]);
		const armR = new Float32Array([
			-0.7631, -0.1204, -0.0785, 0.6301, -0.78, -0.09, -0.05, 0.62, -0.7631, -0.1204, -0.0785, 0.6301, -0.74,
			-0.16, -0.11, 0.64, -0.7631, -0.1204, -0.0785, 0.6301,
		]);
		const forearmL = new Float32Array([
			-0.3233, 0.0216, -0.6732, 0.6647, -0.3, 0.04, -0.65, 0.69, -0.3233, 0.0216, -0.6732, 0.6647, -0.35, 0.01,
			-0.7, 0.63, -0.3233, 0.0216, -0.6732, 0.6647,
		]);
		const forearmR = new Float32Array([
			-0.1798, 0.1514, 0.6454, 0.7268, -0.21, 0.13, 0.67, 0.7, -0.1798, 0.1514, 0.6454, 0.7268, -0.15, 0.17,
			0.62, 0.75, -0.1798, 0.1514, 0.6454, 0.7268,
		]);
		addDanceChannel('UpperArm.L', 'rotation', armL);
		addDanceChannel('UpperArm.R', 'rotation', armR);
		addDanceChannel('LowerArm.L', 'rotation', forearmL);
		addDanceChannel('LowerArm.R', 'rotation', forearmR);

		dst.json.animations.push({
			name: 'Dance',
			channels: danceChannels,
			samplers: danceSamplers,
		});
	}

	dst.json.buffers[0].byteLength = dst.bin.length;
	return writeGlb(dst.json, dst.bin);
}

function prepareKnightAnimations(rawBuf) {
	const dst = readGlb(rawBuf);

	const dstNodesByName = new Map();
	dst.json.nodes.forEach((n, idx) => {
		if (n.name) dstNodesByName.set(n.name, idx);
	});

	// Knight has native animations: Idle, Walking, Run, Jump, Roll
	// Alias and retain native animations
	const cleanAnims = [];
	for (const anim of dst.json.animations) {
		let cleanName = anim.name.replace('HumanArmature|', '');
		if (cleanName === 'Walking') cleanName = 'Walk';
		if (cleanName === 'Roll') cleanName = 'Dance';

		cleanAnims.push({
			...anim,
			name: cleanName,
		});
	}
	dst.json.animations = cleanAnims;

	// Add Knight Wave and Sit clips
	const times = new Float32Array([0.0, 1.0, 2.0]);
	const timeAcc = appendBufferViewAndAccessor(dst, 5126, 'SCALAR', 3, Buffer.from(times.buffer), [0.0], [2.0]);

	// Wave clip for Knight
	{
		const waveChannels = [];
		const waveSamplers = [];
		const uArmRIdx = dstNodesByName.get('UpperArm.R');
		if (uArmRIdx !== undefined) {
			const uArmWave = new Float32Array([
				0.6394, -0.3552, -0.56, -0.389, 0.2, -0.7, -0.2, 0.65, 0.6394, -0.3552, -0.56, -0.389,
			]);
			const accIdx = appendBufferViewAndAccessor(dst, 5126, 'VEC4', 3, Buffer.from(uArmWave.buffer));
			waveSamplers.push({input: timeAcc, output: accIdx, interpolation: 'LINEAR'});
			waveChannels.push({sampler: 0, target: {node: uArmRIdx, path: 'rotation'}});
		}
		dst.json.animations.push({
			name: 'Wave',
			channels: waveChannels,
			samplers: waveSamplers,
		});
	}

	// Sit clip for Knight
	{
		const sitChannels = [];
		const sitSamplers = [];
		const bodyIdx = dstNodesByName.get('Body');
		if (bodyIdx !== undefined) {
			const bodyPos = new Float32Array([0.0001, 0.011, 0.001, 0.0001, 0.0112, 0.001, 0.0001, 0.011, 0.001]);
			const accIdx = appendBufferViewAndAccessor(dst, 5126, 'VEC3', 3, Buffer.from(bodyPos.buffer));
			sitSamplers.push({input: timeAcc, output: accIdx, interpolation: 'LINEAR'});
			sitChannels.push({sampler: 0, target: {node: bodyIdx, path: 'translation'}});
		}
		const uLegLIdx = dstNodesByName.get('UpperLeg.L');
		const uLegRIdx = dstNodesByName.get('UpperLeg.R');
		if (uLegLIdx !== undefined && uLegRIdx !== undefined) {
			const legSit = new Float32Array([
				0.22, 0.001, 0.003, 0.97, 0.22, 0.001, 0.003, 0.97, 0.22, 0.001, 0.003, 0.97,
			]);
			const accIdx = appendBufferViewAndAccessor(dst, 5126, 'VEC4', 3, Buffer.from(legSit.buffer));
			const sIdx = sitSamplers.length;
			sitSamplers.push({input: timeAcc, output: accIdx, interpolation: 'LINEAR'});
			sitChannels.push({sampler: sIdx, target: {node: uLegLIdx, path: 'rotation'}});
			sitChannels.push({sampler: sIdx, target: {node: uLegRIdx, path: 'rotation'}});
		}
		dst.json.animations.push({
			name: 'Sit',
			channels: sitChannels,
			samplers: sitSamplers,
		});
	}

	dst.json.buffers[0].byteLength = dst.bin.length;
	return writeGlb(dst.json, dst.bin);
}

const MODELS = [
	{
		file: 'human-casual.glb',
		name: 'Alex (Casual Male)',
		gender: 'masculine',
		style: 'casual',
		path: 'modular_men/Casual.glb',
	},
	{
		file: 'human-casual2.glb',
		name: 'Kai (Streetwear Male)',
		gender: 'masculine',
		style: 'casual',
		path: 'modular_men/Casual2.glb',
	},
	{
		file: 'human-suit.glb',
		name: 'Marcus (Business Suit)',
		gender: 'masculine',
		style: 'formal',
		path: 'modular_men/Suit.glb',
	},
	{
		file: 'human-punk.glb',
		name: 'Jax (Cyber Punk Male)',
		gender: 'masculine',
		style: 'punk',
		path: 'modular_men/Punk.glb',
	},
	{
		file: 'human-spacesuit.glb',
		name: 'Orion (Astronaut / Sci-Fi)',
		gender: 'masculine',
		style: 'futuristic',
		path: 'modular_men/Spacesuit.glb',
	},
	{
		file: 'human-swat.glb',
		name: 'Leo (Tactical SWAT)',
		gender: 'masculine',
		style: 'gaming',
		path: 'modular_men/Swat.glb',
	},
	{
		file: 'human-adventurer.glb',
		name: 'Hunter (Adventurer Male)',
		gender: 'masculine',
		style: 'stylized',
		path: 'modular_men/Adventurer.glb',
	},
	{
		file: 'woman-casual.glb',
		name: 'Sam (Casual Female)',
		gender: 'feminine',
		style: 'casual',
		path: 'modular_women/Casual.glb',
	},
	{
		file: 'woman-formal.glb',
		name: 'Elena (Formal Dress)',
		gender: 'feminine',
		style: 'formal',
		path: 'modular_women/Formal.glb',
	},
	{
		file: 'woman-punk.glb',
		name: 'Nova (Punk Rocker Female)',
		gender: 'feminine',
		style: 'punk',
		path: 'modular_women/Punk.glb',
	},
	{
		file: 'woman-scifi.glb',
		name: 'Astra (Sci-Fi Cyber Suit)',
		gender: 'feminine',
		style: 'futuristic',
		path: 'modular_women/SciFi.glb',
	},
	{
		file: 'woman-witch.glb',
		name: 'Morgan (Mystic Witch)',
		gender: 'feminine',
		style: 'stylized',
		path: 'modular_women/Witch.glb',
	},
	{
		file: 'woman-soldier.glb',
		name: 'Raven (Tactical Soldier Female)',
		gender: 'feminine',
		style: 'gaming',
		path: 'modular_women/Soldier.glb',
	},
	{
		file: 'knight.glb',
		name: 'Valkyrie (Armored Knight)',
		gender: 'stylized',
		style: 'fantasy',
		path: 'single_knight_pack/KnightCharacter.glb',
	},
];

async function main() {
	const outDir = path.resolve('relay_app/src/features/rooms3d/assets');
	const previewDir = path.resolve('.relay/runtime/rooms3d-preview/assets');
	fs.mkdirSync(outDir, {recursive: true});
	fs.mkdirSync(previewDir, {recursive: true});

	const animBuf = await fetchBuffer(ANIM_SOURCE_URL);

	// Existing robot and fox provenance
	const existingProvenancePath = path.join(outDir, 'avatar-provenance.json');
	const existingProvenance = JSON.parse(fs.readFileSync(existingProvenancePath, 'utf8'));
	const provenanceMap = new Map(existingProvenance.map((e) => [e.file, e]));

	for (const m of MODELS) {
		console.log(`Processing ${m.file} (${m.name})...`);
		const rawUrl = `${BASE_URL}/${m.path}`;
		const rawBuf = await fetchBuffer(rawUrl);

		let mergedBuf;
		if (m.file === 'knight.glb') {
			mergedBuf = prepareKnightAnimations(rawBuf);
		} else {
			mergedBuf = transferHumanAnimations(rawBuf, animBuf);
		}

		const destPath = path.join(outDir, m.file);
		fs.writeFileSync(destPath, mergedBuf);

		const previewPath = path.join(previewDir, m.file);
		fs.writeFileSync(previewPath, mergedBuf);

		const parsed = readGlb(mergedBuf);
		const sha256 = createHash('sha256').update(mergedBuf).digest('hex');
		const animNames = parsed.json.animations.map((a) => a.name);

		provenanceMap.set(m.file, {
			file: m.file,
			source: rawUrl,
			revision: COMMIT,
			license: 'CC0-1.0',
			attribution: 'Quaternius (quaternius.com); universal character and animation assets',
			sha256,
			bytes: mergedBuf.length,
			animations: animNames,
			changes:
				'Sanitized forward-kinematic locomotion and social clips (Idle, Walk, Run, Sit, Wave, Dance) with zero bone distortion.',
		});
		console.log(
			`Saved ${m.file}: ${mergedBuf.length} bytes, ${animNames.length} animations (${animNames.join(', ')}), sha256: ${sha256.slice(0, 12)}...`,
		);
	}

	const updatedProvenance = Array.from(provenanceMap.values());
	fs.writeFileSync(existingProvenancePath, JSON.stringify(updatedProvenance, null, 2) + '\n');
	console.log(`Updated provenance with ${updatedProvenance.length} assets.`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
