import { Column, Label, Row, TextField } from '@umami/react-zen';
import { useConfig, useLoginQuery, useMessages } from '@/components/hooks';
import { ROLES } from '@/lib/constants';
import { PasswordChangeButton } from './PasswordChangeButton';
import { TwoFactorSettingsButton } from './TwoFactorSettingsButton';

export function ProfileSettings() {
  const { user, setUser } = useLoginQuery();
  const { formatMessage, labels } = useMessages();
  const { cloudMode } = useConfig();

  if (!user) {
    return null;
  }

  const { username, role } = user;

  const renderRole = (value: string) => {
    if (value === ROLES.user) {
      return formatMessage(labels.user);
    }
    if (value === ROLES.admin) {
      return formatMessage(labels.admin);
    }
    if (value === ROLES.viewOnly) {
      return formatMessage(labels.viewOnly);
    }

    return formatMessage(labels.unknown);
  };

  return (
    <Column width="100%" gap="8">
      <Column gap="1">
        <Label>{formatMessage(labels.username)}</Label>
        <TextField value={username} isReadOnly />
      </Column>
      <Column gap="1">
        <Label>{formatMessage(labels.role)}</Label>
        <TextField value={renderRole(role)} isReadOnly />
      </Column>
      {!cloudMode && (
        <Column gap="4" paddingTop="4" border="top">
          <Row
            wrap="wrap"
            gap="3"
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
          >
            <Label>{formatMessage(labels.password)}</Label>
            <PasswordChangeButton />
          </Row>
        </Column>
      )}
      {!cloudMode && (
        <Column gap="4">
          <Row
            wrap="wrap"
            gap="3"
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
          >
            <Label>{formatMessage(labels.twoFactorAuthentication)}</Label>
            <Row wrap="wrap" gap="2">
              <TwoFactorSettingsButton user={user} setUser={setUser} />
            </Row>
          </Row>
        </Column>
      )}
    </Column>
  );
}
