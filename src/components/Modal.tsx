import React from 'react';
import {
  Modal as RNModal,
  View,
  Text,
  Pressable,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';

import { Sizes } from '../constants/sizes';
import { Typography } from '../constants/typography';
import { useTheme } from '../contexts/ThemeContext';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  closeOnBackdropPress?: boolean;
  testID?: string;
}

export const Modal: React.FC<ModalProps> = ({
  visible,
  onClose,
  title,
  children,
  closeOnBackdropPress = true,
  testID,
}) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const handleBackdropPress = () => {
    if (closeOnBackdropPress) {
      onClose();
    }
  };

  return (
    <RNModal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      testID={testID}
    >
      <View style={styles.overlay}>
        {/* The backdrop is a pointer affordance only. Screen-reader users dismiss
            with the close button or the platform back gesture, so it is hidden
            rather than announced as an unlabelled tappable region. The props go on
            the Touchable because it clones them onto its child. */}
        <TouchableWithoutFeedback
          onPress={handleBackdropPress}
          accessibilityRole="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View style={styles.backdrop} testID={testID ? `${testID}-backdrop` : 'modal-backdrop'} />
        </TouchableWithoutFeedback>
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            {title && <Text style={[styles.title, { color: colors.text.primary }]}>{title}</Text>}
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              testID={testID ? `${testID}-close-button` : 'modal-close-button'}
              accessibilityRole="button"
              accessibilityLabel={title ? `Close ${title}` : 'Close dialog'}
              accessibilityHint="Dismisses this dialog without saving"
            >
              <Text style={[styles.closeButtonText, { color: colors.text.secondary }]}>✕</Text>
            </Pressable>
          </View>
          <View style={styles.content}>{children}</View>
        </View>
      </View>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    borderRadius: Sizes.borderRadius.lg,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Sizes.spacing.md,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: Typography.fontSize.lg,
    fontWeight: '600',
    flex: 1,
  },
  closeButton: {
    padding: Sizes.spacing.sm,
    marginLeft: Sizes.spacing.sm,
  },
  closeButtonText: {
    fontSize: 24,
  },
  content: {
    padding: Sizes.spacing.md,
  },
});
