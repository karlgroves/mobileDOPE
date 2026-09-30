import { fireEvent } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { Modal } from '../../src/components/Modal';
import { renderWithProviders } from '../helpers/renderWithProviders';

describe('Modal', () => {
  it('should render when visible is true', () => {
    const { getByText } = renderWithProviders(
      <Modal visible={true} onClose={() => {}}>
        <Text>Modal Content</Text>
      </Modal>
    );

    expect(getByText('Modal Content')).toBeTruthy();
  });

  it('should not render when visible is false', () => {
    const { queryByText } = renderWithProviders(
      <Modal visible={false} onClose={() => {}}>
        <Text>Modal Content</Text>
      </Modal>
    );

    expect(queryByText('Modal Content')).toBeNull();
  });

  it('should render title when provided', () => {
    const { getByText } = renderWithProviders(
      <Modal visible={true} title="Test Modal" onClose={() => {}}>
        <Text>Content</Text>
      </Modal>
    );

    expect(getByText('Test Modal')).toBeTruthy();
  });

  it('should call onClose when close button is pressed', () => {
    const onCloseMock = jest.fn();
    const { getByTestId } = renderWithProviders(
      <Modal visible={true} title="Test Modal" onClose={onCloseMock} testID="modal">
        <Text>Content</Text>
      </Modal>
    );

    fireEvent.press(getByTestId('modal-close-button'));
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when backdrop is pressed', () => {
    const onCloseMock = jest.fn();
    const { getByTestId } = renderWithProviders(
      <Modal visible={true} onClose={onCloseMock} testID="modal">
        <Text>Content</Text>
      </Modal>
    );

    // The backdrop is deliberately hidden from the accessibility tree (see Modal:
    // screen-reader users dismiss with the close button, not by tapping a large
    // unlabelled region), and RNTL's queries skip hidden elements by default.
    fireEvent.press(getByTestId('modal-backdrop', { includeHiddenElements: true }));
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('should not close on backdrop press when closeOnBackdropPress is false', () => {
    const onCloseMock = jest.fn();
    const { getByTestId } = renderWithProviders(
      <Modal visible={true} onClose={onCloseMock} closeOnBackdropPress={false} testID="modal">
        <Text>Content</Text>
      </Modal>
    );

    fireEvent.press(getByTestId('modal-backdrop', { includeHiddenElements: true }));
    expect(onCloseMock).not.toHaveBeenCalled();
  });

  it('keeps the backdrop out of the accessibility tree', () => {
    // Asserts the intent above rather than leaving it to a comment: a regression
    // here would make the dialog announce an unlabelled tappable region before its
    // own content.
    const { queryByTestId } = renderWithProviders(
      <Modal visible={true} onClose={jest.fn()} testID="modal">
        <Text>Content</Text>
      </Modal>
    );

    expect(queryByTestId('modal-backdrop')).toBeNull();
    expect(queryByTestId('modal-backdrop', { includeHiddenElements: true })).not.toBeNull();
  });

  it('labels the close button with the dialog it closes', () => {
    const { getByLabelText } = renderWithProviders(
      <Modal visible={true} onClose={jest.fn()} title="Edit Rifle" testID="modal">
        <Text>Content</Text>
      </Modal>
    );

    expect(getByLabelText('Close Edit Rifle')).toBeTruthy();
  });
});
