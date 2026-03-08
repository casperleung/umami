import { Button, Dialog, DialogTrigger, Modal, useToast } from '@umami/react-zen';
import { useMessages } from '@/components/hooks';
import { PasswordEditForm } from './PasswordEditForm';

export function PasswordChangeButton() {
  const { formatMessage, labels, messages } = useMessages();
  const { toast } = useToast();

  const handleSave = () => {
    toast(formatMessage(messages.saved));
  };

  return (
    <DialogTrigger>
      <Button>{formatMessage(labels.changePassword)}</Button>
      <Modal>
        <Dialog title={formatMessage(labels.changePassword)} style={{ width: 400 }}>
          {({ close }) => <PasswordEditForm onSave={handleSave} onClose={close} />}
        </Dialog>
      </Modal>
    </DialogTrigger>
  );
}
