// SPDX-License-Identifier: AGPL-3.0-or-later
import type {MovementInput, RoomTemplateId} from './RoomSchemas';
export interface Position {
	x: number;
	y: number;
	z: number;
}
export interface Obstacle {
	x: number;
	z: number;
	width: number;
	depth: number;
}
export interface RoomSeat {
	id: string;
	x: number;
	z: number;
	rotationY: number;
	label: string;
}
export function roomObstacles(template: RoomTemplateId): Array<Obstacle> {
	if (template === 'meeting') return [{x: 0, z: 0, width: 5.4, depth: 2.4}];
	if (template === 'cinema') return [-0.8, 2.2, 5.2].map((z) => ({x: 0, z, width: 8, depth: 0.8}));
	if (template === 'rooftop')
		return [
			{x: 0, z: 2.8, width: 2.2, depth: 2.2},
			{x: 4.6, z: -1.8, width: 1.2, depth: 4.0},
			{x: -4.2, z: -0.4, width: 1.2, depth: 3.8},
		];
	return [
		{x: -4.2, z: 0, width: 1.2, depth: 4.0},
		{x: 4.2, z: 0, width: 1.2, depth: 4.5},
		{x: -2.4, z: 0, width: 1.4, depth: 1.4},
	];
}
export function roomSeats(template: RoomTemplateId): Array<RoomSeat> {
	if (template === 'meeting') {
		const seats: Array<RoomSeat> = [];
		// 16 chairs around conference table (6 north, 6 south, 2 east, 2 west)
		const xOffsets = [-2.0, -1.2, -0.4, 0.4, 1.2, 2.0];
		xOffsets.forEach((x, i) => {
			seats.push({id: `m-n-${i}`, x, z: -1.45, rotationY: 0, label: 'Conference Chair'});
			seats.push({id: `m-s-${i}`, x, z: 1.45, rotationY: Math.PI, label: 'Conference Chair'});
		});
		seats.push({id: 'm-w-0', x: -2.9, z: -0.5, rotationY: Math.PI / 2, label: 'Conference Chair'});
		seats.push({id: 'm-w-1', x: -2.9, z: 0.5, rotationY: Math.PI / 2, label: 'Conference Chair'});
		seats.push({id: 'm-e-0', x: 2.9, z: -0.5, rotationY: -Math.PI / 2, label: 'Conference Chair'});
		seats.push({id: 'm-e-1', x: 2.9, z: 0.5, rotationY: -Math.PI / 2, label: 'Conference Chair'});
		return seats;
	}
	if (template === 'cinema') {
		const seats: Array<RoomSeat> = [];
		const rows = [-0.8, 2.2, 5.2];
		const xOffsets = [-3.0, -2.0, -1.0, 1.0, 2.0, 3.0];
		rows.forEach((z, r) => {
			xOffsets.forEach((x, c) => {
				seats.push({id: `c-${r}-${c}`, x, z, rotationY: 0, label: 'Theater Seat'});
			});
		});
		return seats;
	}
	if (template === 'rooftop') {
		return [
			{id: 'r-1', x: -4.2, z: -2.2, rotationY: Math.PI / 2, label: 'Lounge Sofa'},
			{id: 'r-2', x: -4.2, z: -1.4, rotationY: Math.PI / 2, label: 'Lounge Sofa'},
			{id: 'r-3', x: -4.2, z: 0.6, rotationY: Math.PI / 2, label: 'Lounge Sofa'},
			{id: 'r-4', x: -4.2, z: 1.4, rotationY: Math.PI / 2, label: 'Lounge Sofa'},
			{id: 'r-5', x: 3.7, z: -2.8, rotationY: -Math.PI / 2, label: 'Bar Stool'},
			{id: 'r-6', x: 3.7, z: -1.8, rotationY: -Math.PI / 2, label: 'Bar Stool'},
			{id: 'r-7', x: 3.7, z: -0.8, rotationY: -Math.PI / 2, label: 'Bar Stool'},
			{id: 'r-8', x: -1.6, z: 2.8, rotationY: Math.PI / 2, label: 'Firepit Chair'},
			{id: 'r-9', x: 1.6, z: 2.8, rotationY: -Math.PI / 2, label: 'Firepit Chair'},
			{id: 'r-10', x: 0, z: 4.2, rotationY: Math.PI, label: 'Firepit Chair'},
		];
	}
	// gaming
	return [
		{id: 'g-s1', x: -4.2, z: -1.9, rotationY: Math.PI / 2, label: 'Lounge Sofa'},
		{id: 'g-s2', x: -4.2, z: -1.1, rotationY: Math.PI / 2, label: 'Lounge Sofa'},
		{id: 'g-s3', x: -4.2, z: 1.1, rotationY: Math.PI / 2, label: 'Lounge Sofa'},
		{id: 'g-s4', x: -4.2, z: 1.9, rotationY: Math.PI / 2, label: 'Lounge Sofa'},
		{id: 'g-c1', x: 3.3, z: -1.4, rotationY: -Math.PI / 2, label: 'Gaming Chair'},
		{id: 'g-c2', x: 3.3, z: 0, rotationY: -Math.PI / 2, label: 'Gaming Chair'},
		{id: 'g-c3', x: 3.3, z: 1.4, rotationY: -Math.PI / 2, label: 'Gaming Chair'},
	];
}
export function nearestSeat(position: Position, template: RoomTemplateId, maxDistance = 1.4): RoomSeat | null {
	let closest: RoomSeat | null = null;
	let minDis = maxDistance;
	for (const seat of roomSeats(template)) {
		const dis = Math.hypot(position.x - seat.x, position.z - seat.z);
		if (dis < minDis) {
			minDis = dis;
			closest = seat;
		}
	}
	return closest;
}
export function moveAvatar(
	position: Position,
	input: Pick<MovementInput, 'x' | 'z' | 'run'>,
	seconds: number,
	template: RoomTemplateId,
): Position {
	const length = Math.max(1, Math.hypot(input.x, input.z));
	const distance = (input.run ? 5 : 3) * Math.max(0, Math.min(0.2, seconds));
	const blocked = (x: number, z: number) =>
		roomObstacles(template).some(
			(o) => Math.abs(x - o.x) < o.width / 2 + 0.35 && Math.abs(z - o.z) < o.depth / 2 + 0.35,
		);
	let x = Math.max(-9.5, Math.min(9.5, position.x + (input.x / length) * distance));
	if (blocked(x, position.z)) x = position.x;
	let z = Math.max(-7.5, Math.min(7.5, position.z + (input.z / length) * distance));
	if (blocked(x, z)) z = position.z;
	return {x, y: 0, z};
}
export function distanceGain(distance: number): number {
	if (!Number.isFinite(distance)) return 1;
	return 1 - Math.max(0, Math.min(1, (distance - 2) / 16)) * 0.85;
}
export function interpolationFactor(seconds: number): number {
	return 1 - Math.exp(-12 * Math.max(0, seconds));
}
