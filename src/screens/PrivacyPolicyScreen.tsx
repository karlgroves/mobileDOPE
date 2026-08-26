/**
 * Privacy Policy Screen
 *
 * The policy ships inside the app rather than behind a link. Mobile DOPE is
 * offline-first and has no network layer at all, so a policy the user can only
 * read with a working connection would be unreadable exactly where the app is
 * designed to be used. The canonical published copy lives in `PRIVACY.md` at the
 * repository root; this screen and that file are kept in step.
 *
 * See issue #44.
 */

import React from 'react';
import { View, ScrollView, Text, StyleSheet } from 'react-native';

import { Card } from '../components';
import { useTheme } from '../contexts/ThemeContext';

import type { RootStackScreenProps } from '../navigation/types';

/** One headed block of policy text. */
interface Section {
  heading: string;
  paragraphs: string[];
}

const SECTIONS: Section[] = [
  {
    heading: 'Nothing leaves this device on its own',
    paragraphs: [
      'Mobile DOPE has no network layer. There is no analytics, no crash reporting, ' +
        'no telemetry, no advertising identifier, and no code that contacts a remote ' +
        'server. There are no accounts and no cloud sync.',
      'The only way your data leaves this device is when you export or share a file ' + 'yourself.',
    ],
  },
  {
    heading: 'What is stored here',
    paragraphs: [
      'Rifle and ammunition profiles, environmental readings, DOPE logs, range ' +
        'sessions, shot strings and your app settings. All of it is written to a ' +
        "private database inside the app's own storage, readable only by this app.",
    ],
  },
  {
    heading: 'Location',
    paragraphs: [
      'Location is requested only while you are using the app, and only when you ask ' +
        'the Environment screen to fetch conditions. It is never used in the background.',
      'It is read for two things: altitude, which feeds the density-altitude term in ' +
        'the ballistic solution, and latitude, which the Coriolis correction uses.',
      'Latitude is rounded to one decimal place — about 11 kilometres — before it is ' +
        'saved. The Coriolis model changes by roughly 1.7% per whole degree, so this ' +
        'costs no accuracy and means the stored value does not identify where you shot.',
      'Longitude is never recorded. No calculation in the app uses it.',
      'You can decline location entirely. Altitude can be entered by hand and the app ' +
        'remains fully usable.',
    ],
  },
  {
    heading: 'Exports include your approximate latitude',
    paragraphs: [
      'A full JSON backup carries the rounded latitude stored with each environmental ' +
        'reading. Before creating one, the app tells you so and offers to leave the ' +
        'coordinates out. A backup without coordinates still restores completely.',
      'Once you send a file to another app, a cloud drive or a person, this policy no ' +
        'longer governs what happens to it.',
    ],
  },
  {
    heading: 'Deleting your data',
    paragraphs: [
      'Settings › Privacy › Delete Stored Location Data removes the latitude from every ' +
        'stored reading and keeps the temperature, pressure and wind values.',
      'Settings › Data Management › Clear All Data removes everything.',
      'Uninstalling the app deletes its private storage, settings included.',
    ],
  },
  {
    heading: 'Permissions',
    paragraphs: [
      'Location while in use is the only runtime permission this app requests. Camera, ' +
        'photo library, microphone and motion permissions are explicitly blocked in the ' +
        'build configuration so that bundled libraries cannot introduce them.',
    ],
  },
];

export const PrivacyPolicyScreen: React.FC<RootStackScreenProps<'PrivacyPolicy'>> = () => {
  const { theme } = useTheme();
  const { colors } = theme;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        accessibilityLabel="Privacy policy"
        accessibilityHint="Scroll to read how Mobile DOPE handles your data"
      >
        <Text style={[styles.updated, { color: colors.text.secondary }]}>
          Last updated 26 August 2026
        </Text>

        {SECTIONS.map((section) => (
          <Card key={section.heading} style={styles.card}>
            <Text
              accessibilityRole="header"
              style={[styles.heading, { color: colors.text.primary }]}
            >
              {section.heading}
            </Text>
            {section.paragraphs.map((paragraph) => (
              <Text key={paragraph} style={[styles.body, { color: colors.text.secondary }]}>
                {paragraph}
              </Text>
            ))}
          </Card>
        ))}

        <Text style={[styles.footer, { color: colors.text.secondary }]}>
          The full policy is published at github.com/karlgroves/mobileDOPE in PRIVACY.md
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    marginBottom: 12,
  },
  updated: {
    fontSize: 13,
    marginBottom: 12,
  },
  heading: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
  },
  footer: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default PrivacyPolicyScreen;
