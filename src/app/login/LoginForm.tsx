import {
  Button,
  Column,
  Form,
  FormButtons,
  FormField,
  FormSubmitButton,
  Heading,
  Icon,
  PasswordField,
  Switch,
  Text,
  TextField,
} from '@umami/react-zen';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMessages, useMobile, useUpdateQuery } from '@/components/hooks';
import { Logo } from '@/components/svg';
import {
  getClientTwoFactorTrustToken,
  removeClientTwoFactorTrustToken,
  setClientAuthToken,
  setClientTwoFactorTrustToken,
} from '@/lib/client';
import { setUser } from '@/store/app';

export function LoginForm() {
  const { formatMessage, labels, messages, getErrorMessage } = useMessages();
  const { isPhone } = useMobile();
  const router = useRouter();
  const login = useUpdateQuery('/auth/login');
  const verify = useUpdateQuery('/auth/login/2fa');
  const [challengeToken, setChallengeToken] = useState<string>(null);
  const [rememberDevice, setRememberDevice] = useState(false);
  const actionButtonStyle = isPhone ? { width: '100%' } : undefined;

  const completeLogin = async ({ token, user, trustedToken }: any) => {
    setClientAuthToken(token);

    if (trustedToken) {
      setClientTwoFactorTrustToken(trustedToken);
    }

    setUser(user);
    router.push('/');
  };

  const handleSubmit = async (data: any) => {
    const trustedToken = getClientTwoFactorTrustToken();

    await login.mutateAsync(
      { ...data, ...(trustedToken ? { trustedToken } : {}) },
      {
        onSuccess: async response => {
          if (response?.twoFactorRequired) {
            removeClientTwoFactorTrustToken();
            setRememberDevice(false);
            setChallengeToken(response.challengeToken);
            return;
          }

          await completeLogin(response);
        },
      },
    );
  };

  const handleVerify = async (data: any) => {
    await verify.mutateAsync(
      { challengeToken, code: data.code, rememberDevice },
      {
        onSuccess: completeLogin,
      },
    );
  };

  const error = challengeToken ? verify.error : login.error;

  return (
    <Column justifyContent="center" alignItems="center" gap="6">
      <Icon size="lg">
        <Logo />
      </Icon>
      <Heading>umami</Heading>
      {challengeToken ? (
        <Form onSubmit={handleVerify} error={getErrorMessage(error)} style={{ width: '100%' }}>
          <Text color="muted">{formatMessage(messages.twoFactorPrompt)}</Text>
          <FormField
            label={formatMessage(labels.twoFactorCode)}
            data-test="input-two-factor-code"
            name="code"
            rules={{ required: formatMessage(labels.required) }}
          >
            <TextField autoComplete="one-time-code" />
          </FormField>
          <Switch isSelected={rememberDevice} onChange={setRememberDevice}>
            {formatMessage(labels.trustDevice30Days)}
          </Switch>
          {isPhone ? (
            <Column gap="2">
              <Button
                style={actionButtonStyle}
                onPress={() => {
                  setRememberDevice(false);
                  setChallengeToken(null);
                }}
              >
                {formatMessage(labels.back)}
              </Button>
              <FormSubmitButton
                data-test="button-two-factor-submit"
                isDisabled={verify.isPending}
                style={actionButtonStyle}
              >
                {formatMessage(labels.verify)}
              </FormSubmitButton>
            </Column>
          ) : (
            <FormButtons>
              <Button
                onPress={() => {
                  setRememberDevice(false);
                  setChallengeToken(null);
                }}
              >
                {formatMessage(labels.back)}
              </Button>
              <FormSubmitButton data-test="button-two-factor-submit" isDisabled={verify.isPending}>
                {formatMessage(labels.verify)}
              </FormSubmitButton>
            </FormButtons>
          )}
        </Form>
      ) : (
        <Form onSubmit={handleSubmit} error={getErrorMessage(error)}>
          <FormField
            label={formatMessage(labels.username)}
            data-test="input-username"
            name="username"
            rules={{ required: formatMessage(labels.required) }}
          >
            <TextField autoComplete="username" />
          </FormField>

          <FormField
            label={formatMessage(labels.password)}
            data-test="input-password"
            name="password"
            rules={{ required: formatMessage(labels.required) }}
          >
            <PasswordField autoComplete="current-password" />
          </FormField>
          <FormButtons>
            <FormSubmitButton
              data-test="button-submit"
              variant="primary"
              style={{ flex: 1 }}
              isDisabled={login.isPending}
            >
              {formatMessage(labels.login)}
            </FormSubmitButton>
          </FormButtons>
        </Form>
      )}
    </Column>
  );
}
