import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from '../components/Button';
import { useTheme } from '../contexts/ThemeContext';
import type { RangeStackScreenProps } from '../navigation/types';

type Props = RangeStackScreenProps<'RangeSessionStart'>;

export const RangeScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useTheme();
  const { colors } = theme;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.text, { color: colors.text.primary }]}>Range Session</Text>
      <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
        Manage shooting sessions and DOPE logs
      </Text>

      <View style={styles.buttonContainer}>
        <Button
          title="Environmental Conditions"
          onPress={() => navigation.navigate('EnvironmentInput')}
          variant="primary"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 300,
  },
});
