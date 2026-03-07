import { Column, Label, Row } from '@umami/react-zen';
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
    <Column width="400px" gap="6">
      <Column>
        <Label>{formatMessage(labels.username)}</Label>
        {username}
      </Column>
      <Column>
        <Label>{formatMessage(labels.role)}</Label>
        {renderRole(role)}
      </Column>
      {!cloudMode && (
        <Column>
          <Label>{formatMessage(labels.password)}</Label>
          <PasswordChangeButton />
        </Column>
      )}
      {!cloudMode && (
        <Column>
          <Label>{formatMessage(labels.twoFactorAuthentication)}</Label>
          <Row wrap="wrap" gap="2">
            <TwoFactorSettingsButton user={user} setUser={setUser} />
          </Row>
        </Column>
      )}
    </Column>
  );
}
