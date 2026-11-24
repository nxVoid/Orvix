// SPDX-License-Identifier: AGPL-3.0-or-later

import {Button} from '@app/features/ui/button/Button';
import {Input, Textarea} from '@app/features/ui/components/form/FormInput';
import {sendWebhookTestMessage, rotateWebhookToken} from '@app/features/webhook/commands/WebhookCommands';
import styles from '@app/features/webhook/components/WebhookMessageComposer.module.css';
import {Trans, useLingui} from '@lingui/react/macro';
import {useState} from 'react';

export function WebhookMessageComposer({webhookId}: {webhookId: string}) {
	const {t} = useLingui();
	const [content, setContent] = useState('');
	const [title, setTitle] = useState('');
	const [description, setDescription] = useState('');
	const [color, setColor] = useState('#5865f2');
	const [image, setImage] = useState('');
	const [thumbnail, setThumbnail] = useState('');
	const [busy, setBusy] = useState(false);
	const [confirmRotation, setConfirmRotation] = useState(false);
	const [status, setStatus] = useState('');
	const hasEmbed = Boolean(title || description || image || thumbnail);
	const validUrl = (value: string) => {
		if (!value) return true;
		try {
			return new URL(value).protocol === 'https:';
		} catch {
			return false;
		}
	};
	const valid = Boolean(content.trim() || hasEmbed) && validUrl(image) && validUrl(thumbnail);
	const perform = async (rotate: boolean) => {
		setBusy(true);
		setStatus('');
		try {
			if (rotate) {
				await rotateWebhookToken(webhookId);
				setConfirmRotation(false);
				setStatus(t`Token renewed. Previous webhook URLs no longer work.`);
			} else {
				await sendWebhookTestMessage(webhookId, {
					...(content ? {content} : {}),
					...(hasEmbed
						? {
								embeds: [
									{
										title: title || undefined,
										description: description || undefined,
										color: Number.parseInt(color.slice(1), 16),
										image: image ? {url: image} : undefined,
										thumbnail: thumbnail ? {url: thumbnail} : undefined,
									},
								],
							}
						: {}),
				});
				setStatus(t`Test message sent.`);
			}
		} catch {
			// Never render or log transport errors: they can carry credentials or request payloads.
			setStatus(t`Request failed. Check your permissions and message fields, or wait before trying again.`);
		} finally {
			setBusy(false);
		}
	};
	return (
		<section className={styles.composer} data-flx="webhook.composer">
			<h3>
				<Trans>Test message</Trans>
			</h3>
			<Textarea label={t`Message`} value={content} maxLength={2000} onChange={(e) => setContent(e.target.value)} />
			<Input label={t`Embed title`} value={title} maxLength={256} onChange={(e) => setTitle(e.target.value)} />
			<Textarea
				label={t`Embed description`}
				value={description}
				maxLength={4096}
				onChange={(e) => setDescription(e.target.value)}
			/>
			<Input label={t`Embed color`} type="color" value={color} onChange={(e) => setColor(e.target.value)} />
			<Input label={t`Banner image URL (HTTPS)`} type="url" value={image} onChange={(e) => setImage(e.target.value)} />
			<Input
				label={t`Thumbnail URL (HTTPS)`}
				type="url"
				value={thumbnail}
				onChange={(e) => setThumbnail(e.target.value)}
			/>
			<h4>
				<Trans>Message preview</Trans>
			</h4>
			<div className={styles.preview}>
				<p>{content}</p>
				{hasEmbed && (
					<div className={styles.embed} style={{borderLeftColor: color}}>
						{thumbnail && validUrl(thumbnail) && (
							<img
								className={styles.thumbnail}
								src={thumbnail}
								alt={t`Thumbnail preview`}
								referrerPolicy="no-referrer"
							/>
						)}
						<strong>{title}</strong>
						<p>{description}</p>
						{image && validUrl(image) && (
							<img className={styles.banner} src={image} alt={t`Banner preview`} referrerPolicy="no-referrer" />
						)}
					</div>
				)}
			</div>
			<Button variant="secondary" disabled={!valid || busy} submitting={busy} onClick={() => perform(false)}>
				<Trans>Send test message</Trans>
			</Button>
			<Button variant="secondary" disabled={busy} onClick={() => setConfirmRotation(!confirmRotation)}>
				<Trans>Renew token</Trans>
			</Button>
			{confirmRotation && (
				<div role="alert">
					<p>
						<Trans>All previous webhook URLs will stop working. Update any connected services after renewing.</Trans>
					</p>
					<Button variant="danger" disabled={busy} onClick={() => perform(true)}>
						<Trans>Renew and invalidate old URLs</Trans>
					</Button>
				</div>
			)}
			<p role="status">{status}</p>
		</section>
	);
}
