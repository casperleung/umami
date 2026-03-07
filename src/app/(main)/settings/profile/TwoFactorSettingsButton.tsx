import {
  Button,
  Column,
  Dialog,
  DialogTrigger,
  Form,
  FormButtons,
  FormField,
  FormSubmitButton,
  Label,
  Modal,
  PasswordField,
  Row,
  Text,
  TextField,
  useToast,
} from '@umami/react-zen';
import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';
import { useApi, useMessages, useMobile } from '@/components/hooks';
import { removeClientTwoFactorTrustToken } from '@/lib/client';
import type { ApiError } from '@/lib/types';

interface TwoFactorSettingsButtonProps {
  user: any;
  setUser: (user: any) => void;
}

async function copyToClipboard(value: string) {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

const qrCodeWrapperStyle: CSSProperties = {
  alignItems: 'center',
  background: 'var(--zen-colors-base2)',
  border: '1px solid var(--zen-colors-border)',
  borderRadius: 8,
  display: 'flex',
  justifyContent: 'center',
  padding: 12,
};

const qrCodeStyle: CSSProperties = {
  height: 'auto',
  maxWidth: '100%',
  width: 280,
};

const recoveryCodesStyle: CSSProperties = {
  background: 'var(--zen-colors-base2)',
  border: '1px solid var(--zen-colors-border)',
  borderRadius: 8,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontSize: 13,
  lineHeight: 1.5,
  margin: 0,
  maxHeight: 220,
  overflow: 'auto',
  padding: 12,
  whiteSpace: 'pre-wrap',
  width: '100%',
};

function TwoFactorDialog({ title, children }: { title: ReactNode; children: any }) {
  const { isMobile } = useMobile();
  const style: CSSProperties = isMobile
    ? {
        height: '100%',
        maxHeight: '100%',
        overflowY: 'auto',
        padding: 24,
        width: '100%',
      }
    : {
        maxHeight: 'calc(100dvh - 40px)',
        maxWidth: 'calc(100vw - 40px)',
        overflowX: 'hidden',
        overflowY: 'auto',
        width: 520,
      };

  return (
    <Modal placement={isMobile ? 'fullscreen' : 'center'}>
      <Dialog variant={isMobile ? 'sheet' : undefined} title={title} style={style}>
        {children}
      </Dialog>
    </Modal>
  );
}

function RecoveryCodes({
  codes,
  copyLabel,
  onCopy,
}: {
  codes: string[];
  copyLabel: string;
  onCopy: () => void;
}) {
  return (
    <Column gap="2">
      <Row justifyContent="flex-end">
        <Button variant="quiet" onPress={onCopy} data-test="button-copy-recovery-codes">
          {copyLabel}
        </Button>
      </Row>
      <pre style={recoveryCodesStyle}>{codes.join('\n')}</pre>
    </Column>
  );
}

function EnableTwoFactorForm({ user, setUser, onClose }: any) {
  const { post } = useApi();
  const { formatMessage, labels, messages, getErrorMessage } = useMessages();
  const { toast } = useToast();
  const [setup, setSetup] = useState<any>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState<ApiError>(null);
  const [isPending, setIsPending] = useState(false);

  const handleCopyRecoveryCodes = async () => {
    const success = await copyToClipboard(recoveryCodes.join('\n'));
    toast(
      formatMessage(
        success ? messages.twoFactorRecoveryCopied : messages.twoFactorRecoveryCopyFailed,
      ),
    );
  };

  const handlePassword = async ({ currentPassword }: Record<string, string>) => {
    setIsPending(true);
    setError(null);

    try {
      const data = await post('/me/2fa/setup', { currentPassword });
      setSetup(data);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setIsPending(false);
    }
  };

  const handleVerify = async ({ code }: Record<string, string>) => {
    setIsPending(true);
    setError(null);

    try {
      const data = await post('/me/2fa/enable', {
        setupToken: setup?.setupToken,
        code,
      });

      setRecoveryCodes(data.recoveryCodes || []);
      toast(formatMessage(messages.saved));
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setIsPending(false);
    }
  };

  if (recoveryCodes.length) {
    return (
      <Column gap="4">
        <Label>{formatMessage(messages.twoFactorSetupStepRecovery)}</Label>
        <Text color="muted">{formatMessage(messages.twoFactorRecoveryWarning)}</Text>
        <RecoveryCodes
          codes={recoveryCodes}
          copyLabel={formatMessage(labels.copyCodes)}
          onCopy={handleCopyRecoveryCodes}
        />
        <FormButtons>
          <Button
            variant="primary"
            onPress={() => {
              setUser({ ...user, twoFactorEnabled: true });
              onClose();
            }}
          >
            {formatMessage(labels.iSavedRecoveryCodes)}
          </Button>
        </FormButtons>
      </Column>
    );
  }

  if (setup) {
    return (
      <Form onSubmit={handleVerify} error={getErrorMessage(error)}>
        <Column gap="4">
          <Label>{formatMessage(messages.twoFactorSetupStepScan)}</Label>
          <Text color="muted">{formatMessage(messages.twoFactorSetupPrompt)}</Text>
          {setup.qrCodeDataUrl && (
            <div style={qrCodeWrapperStyle}>
              <img src={setup.qrCodeDataUrl} alt="Two-factor QR code" style={qrCodeStyle} />
            </div>
          )}
          <Column gap="1">
            <Label>{formatMessage(labels.manualKey)}</Label>
            <TextField value={setup.manualCode} isReadOnly allowCopy autoComplete="off" />
          </Column>
          <Label>{formatMessage(messages.twoFactorSetupStepVerify)}</Label>
          <FormField
            label={formatMessage(labels.twoFactorCode)}
            name="code"
            rules={{ required: formatMessage(labels.required) }}
          >
            <TextField autoComplete="one-time-code" inputMode="numeric" placeholder="123456" />
          </FormField>
          <FormButtons>
            <Button variant="quiet" onPress={() => setSetup(null)}>
              {formatMessage(labels.back)}
            </Button>
            <FormSubmitButton isDisabled={isPending} variant="primary">
              {formatMessage(labels.verify)}
            </FormSubmitButton>
          </FormButtons>
        </Column>
      </Form>
    );
  }

  return (
    <Form onSubmit={handlePassword} error={getErrorMessage(error)}>
      <Text color="muted">{formatMessage(messages.twoFactorSetupIntro)}</Text>
      <FormField
        label={formatMessage(labels.currentPassword)}
        name="currentPassword"
        rules={{ required: formatMessage(labels.required) }}
      >
        <PasswordField autoComplete="current-password" />
      </FormField>
      <FormButtons>
        <Button variant="quiet" onPress={onClose}>
          {formatMessage(labels.cancel)}
        </Button>
        <FormSubmitButton isDisabled={isPending} variant="primary">
          {formatMessage(labels.continue)}
        </FormSubmitButton>
      </FormButtons>
    </Form>
  );
}

function DisableTwoFactorForm({ user, setUser, onClose }: any) {
  const { post } = useApi();
  const { formatMessage, labels, messages, getErrorMessage } = useMessages();
  const { toast } = useToast();
  const [error, setError] = useState<ApiError>(null);
  const [isPending, setIsPending] = useState(false);

  const handleDisable = async ({ currentPassword }: Record<string, string>) => {
    setIsPending(true);
    setError(null);

    try {
      await post('/me/2fa/disable', { currentPassword });
      removeClientTwoFactorTrustToken();
      setUser({ ...user, twoFactorEnabled: false });
      toast(formatMessage(messages.saved));
      onClose();
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Form onSubmit={handleDisable} error={getErrorMessage(error)}>
      <FormField
        label={formatMessage(labels.currentPassword)}
        name="currentPassword"
        rules={{ required: formatMessage(labels.required) }}
      >
        <PasswordField autoComplete="current-password" />
      </FormField>
      <FormButtons>
        <Button variant="quiet" onPress={onClose}>
          {formatMessage(labels.cancel)}
        </Button>
        <FormSubmitButton isDisabled={isPending} variant="danger">
          {formatMessage(labels.disableTwoFactor)}
        </FormSubmitButton>
      </FormButtons>
    </Form>
  );
}

function RecoveryCodesForm({ onClose }: any) {
  const { post } = useApi();
  const { formatMessage, labels, messages, getErrorMessage } = useMessages();
  const { toast } = useToast();
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState<ApiError>(null);
  const [isPending, setIsPending] = useState(false);

  const handleCopyRecoveryCodes = async () => {
    const success = await copyToClipboard(recoveryCodes.join('\n'));
    toast(
      formatMessage(
        success ? messages.twoFactorRecoveryCopied : messages.twoFactorRecoveryCopyFailed,
      ),
    );
  };

  const handleRegenerate = async ({ currentPassword }: Record<string, string>) => {
    setIsPending(true);
    setError(null);

    try {
      const data = await post('/me/2fa/recovery-codes', { currentPassword });
      setRecoveryCodes(data.recoveryCodes || []);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setIsPending(false);
    }
  };

  if (recoveryCodes.length) {
    return (
      <Column gap="4">
        <Text color="muted">{formatMessage(messages.twoFactorRecoveryWarning)}</Text>
        <RecoveryCodes
          codes={recoveryCodes}
          copyLabel={formatMessage(labels.copyCodes)}
          onCopy={handleCopyRecoveryCodes}
        />
        <FormButtons>
          <Button variant="primary" onPress={onClose}>
            {formatMessage(labels.ok)}
          </Button>
        </FormButtons>
      </Column>
    );
  }

  return (
    <Form onSubmit={handleRegenerate} error={getErrorMessage(error)}>
      <FormField
        label={formatMessage(labels.currentPassword)}
        name="currentPassword"
        rules={{ required: formatMessage(labels.required) }}
      >
        <PasswordField autoComplete="current-password" />
      </FormField>
      <FormButtons>
        <Button variant="quiet" onPress={onClose}>
          {formatMessage(labels.cancel)}
        </Button>
        <FormSubmitButton isDisabled={isPending} variant="primary">
          {formatMessage(labels.regenerateRecoveryCodes)}
        </FormSubmitButton>
      </FormButtons>
    </Form>
  );
}

export function TwoFactorSettingsButton({ user, setUser }: TwoFactorSettingsButtonProps) {
  const { formatMessage, labels } = useMessages();

  if (!user?.twoFactorEnabled) {
    return (
      <Row gap="2" wrap="wrap">
        <DialogTrigger>
          <Button data-test="button-two-factor-enable" variant="primary">
            {formatMessage(labels.enableTwoFactor)}
          </Button>
          <TwoFactorDialog title={formatMessage(labels.enableTwoFactor)}>
            {({ close }) => <EnableTwoFactorForm user={user} setUser={setUser} onClose={close} />}
          </TwoFactorDialog>
        </DialogTrigger>
      </Row>
    );
  }

  return (
    <Row gap="2" wrap="wrap">
      <DialogTrigger>
        <Button data-test="button-two-factor-disable" variant="danger">
          {formatMessage(labels.disableTwoFactor)}
        </Button>
        <TwoFactorDialog title={formatMessage(labels.disableTwoFactor)}>
          {({ close }) => <DisableTwoFactorForm user={user} setUser={setUser} onClose={close} />}
        </TwoFactorDialog>
      </DialogTrigger>
      <DialogTrigger>
        <Button data-test="button-two-factor-recovery" variant="quiet">
          {formatMessage(labels.regenerateRecoveryCodes)}
        </Button>
        <TwoFactorDialog title={formatMessage(labels.recoveryCodes)}>
          {({ close }) => <RecoveryCodesForm onClose={close} />}
        </TwoFactorDialog>
      </DialogTrigger>
    </Row>
  );
}
