import { forwardRef } from 'react';
import { TextInput as RNTextInput, type TextInputProps } from 'react-native';

import { notifyTextInputFocused } from '@/lib/keyboard';

export const TextInput = forwardRef<RNTextInput, TextInputProps>(
  function TextInput({ onFocus, ...props }, ref) {
    return (
      <RNTextInput
        ref={ref}
        {...props}
        onFocus={(event) => {
          notifyTextInputFocused();
          onFocus?.(event);
        }}
      />
    );
  },
);
