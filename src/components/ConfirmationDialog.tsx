import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Modal } from './Modal';
import { Button } from './Button';
import { useTheme } from '../contexts/ThemeContext';

export interface ConfirmationDialogProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
}) => {
  const { theme } = useTheme();
  const { colors } = theme;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const getConfirmVariant = () => {
    switch (variant) {
      case 'danger':
        return 'danger';
      case 'warning':
        return 'secondary';
      case 'info':
        return 'primary';
      default:
        return 'primary';
    }
  };

  return (
    <Modal visible={visible} onClose={onClose} title={title}>
      <View style={styles.content}>
        <Text style={[styles.message, { color: colors.text.primary }]}>{message}</Text>

        <View style={styles.buttonContainer}>
          <Button title={cancelText} onPress={onClose} variant="secondary" style={styles.button} />
          <Button
            title={confirmText}
            onPress={handleConfirm}
            variant={getConfirmVariant()}
            style={styles.button}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingVertical: 16,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  button: {
    flex: 1,
    maxWidth: 150,
  },
});
