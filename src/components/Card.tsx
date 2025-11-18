import React from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export interface CardProps {
  children?: React.ReactNode;
  title?: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  testID?: string;
}

export const Card: React.FC<CardProps> = ({ children, title, subtitle, style, onPress, testID }) => {
  const { theme } = useTheme();
  const { colors } = theme;

  const containerStyle = [
    styles.card,
    { backgroundColor: colors.surface },
    style,
  ];

  const content = (
    <>
      {title && (
        <Text style={[styles.title, { color: colors.text.primary }]}>{title}</Text>
      )}
      {subtitle && (
        <Text style={[styles.subtitle, { color: colors.text.secondary }]}>{subtitle}</Text>
      )}
      {children}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [
          ...containerStyle,
          pressed && styles.pressed,
        ]}
        onPress={onPress}
        testID={testID}
        accessible={true}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={containerStyle} testID={testID}>
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 8,
  },
  pressed: {
    opacity: 0.7,
  },
});
