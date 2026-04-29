import { Column, Label, Row, TextField } from '@umami/react-zen';
import { useConfig, useLoginQuery, useMessages } from '@/components/hooks';
import { ROLES } from '@/lib/constants';
import { PasswordChangeButton } from './PasswordChangeButton';
import { TwoFactorSettingsButton } from './TwoFactorSettingsButton';

export function ProfileSettings() {
  const { user, setUser } = useLoginQuery();
  const { t, labels } = useMessages();
  const { cloudMode } = useConfig();

  if (!user) {
    return null;
  }

  const { username, role } = user;

  const renderRole = (value: string) => {
    if (value === ROLES.user) {
      return t(labels.user);
    }
    if (value === ROLES.admin) {
      return t(labels.admin);
    }
    if (value === ROLES.viewOnly) {
      return t(labels.viewOnly);
    }

    return t(labels.unknown);
  };

  return (
    <Column gap="6">
      <Column>
        <Label>{t(labels.username)}</Label>
        {username}
      </Column>
      <Column>
        <Label>{t(labels.role)}</Label>
        {renderRole(role)}
      </Column>
      {!cloudMode && (
        <Column>
          <Label>{t(labels.password)}</Label>
          <Row>
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
            <Label>{t(labels.twoFactorAuthentication)}</Label>
            <Row wrap="wrap" gap="2">
              <TwoFactorSettingsButton user={user} setUser={setUser} />
            </Row>
          </Row>
        </Column>
      )}
    </Column>
  );
}
