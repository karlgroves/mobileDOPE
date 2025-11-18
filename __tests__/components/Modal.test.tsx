import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { Modal } from '../../src/components/Modal';

describe('Modal', () => {
  it('should render when visible is true', () => {
    const { getByText } = render(
      <Modal visible={true} onClose={() => {}}>
        <Text>Modal Content</Text>
      </Modal>
    );

    expect(getByText('Modal Content')).toBeTruthy();
  });

  it('should not render when visible is false', () => {
    const { queryByText } = render(
      <Modal visible={false} onClose={() => {}}>
        <Text>Modal Content</Text>
      </Modal>
    );

    expect(queryByText('Modal Content')).toBeNull();
  });

  it('should render title when provided', () => {
    const { getByText } = render(
      <Modal visible={true} title="Test Modal" onClose={() => {}}>
        <Text>Content</Text>
      </Modal>
    );

    expect(getByText('Test Modal')).toBeTruthy();
  });

  it('should call onClose when close button is pressed', () => {
    const onCloseMock = jest.fn();
    const { getByTestId } = render(
      <Modal visible={true} title="Test Modal" onClose={onCloseMock} testID="modal">
        <Text>Content</Text>
      </Modal>
    );

    fireEvent.press(getByTestId('modal-close-button'));
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when backdrop is pressed', () => {
    const onCloseMock = jest.fn();
    const { getByTestId } = render(
      <Modal visible={true} onClose={onCloseMock} testID="modal">
        <Text>Content</Text>
      </Modal>
    );

    fireEvent.press(getByTestId('modal-backdrop'));
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('should not close on backdrop press when closeOnBackdropPress is false', () => {
    const onCloseMock = jest.fn();
    const { getByTestId } = render(
      <Modal
        visible={true}
        onClose={onCloseMock}
        closeOnBackdropPress={false}
        testID="modal"
      >
        <Text>Content</Text>
      </Modal>
    );

    fireEvent.press(getByTestId('modal-backdrop'));
    expect(onCloseMock).not.toHaveBeenCalled();
  });
});
