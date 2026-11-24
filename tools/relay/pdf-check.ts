import assert from 'node:assert/strict';
import {PDFDict, PDFDocument, PDFName} from 'pdf-lib';
import {buildRecoveryKitPdf} from '../../relay_app/src/features/auth/utils/RecoveryKitSheet';

let phase = 'generate';
async function main() {
	const key = '0000-1111-2222-3333-4444-5555-6666-7777';
	const bytes = await buildRecoveryKitPdf({
		productName: 'Relay',
		title: 'Relay recovery kit',
		intro: 'Keep this kit private.',
		details: [{label: 'Account', value: 'synthetic_fixture'}],
		keyLabel: 'Recovery key',
		recoveryKey: key,
		recoverUrl: `https://example.invalid/recover#username=synthetic_fixture&key=${key}`,
		qrCaption: 'Private recovery link',
		stepsTitle: 'Recovery steps',
		steps: ['Open your instance and enter this key.'],
		backupCodes: null,
	});
	phase = 'load';
	const pdf = await PDFDocument.load(bytes, {updateMetadata: false});
	phase = 'metadata';
	assert.equal(pdf.getTitle(), 'Relay recovery kit');
	assert.equal(pdf.getCreator(), 'Relay');
	assert.equal(pdf.getProducer(), 'Relay');
	phase = 'images';
	let images = 0;
	for (const [, object] of pdf.context.enumerateIndirectObjects()) {
		const dict = object instanceof PDFDict ? object : (object as {dict?: PDFDict}).dict;
		if (dict?.get(PDFName.of('Subtype')) === PDFName.of('Image')) images++;
	}
	console.log('Embedded PDF images', images);
	assert.ok(images >= 2, 'PDF must contain both the Relay logo and the recovery QR');
	assert.ok(pdf.getPageCount() >= 1);
	console.log('Recovery PDF: Relay metadata, embedded logo and QR passed (synthetic credentials only).');
}
main().catch((error) => {
	console.error('Recovery PDF branding check failed during', phase, 'error type', error.name);
	console.error(String(error.stack).split('\n').slice(1, 4).join('\n'));
	process.exitCode = 1;
});
