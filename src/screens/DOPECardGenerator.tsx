/**
 * DOPE Card Generator Screen
 * Creates printable DOPE cards with ballistic data
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { SegmentedControl } from '../components/SegmentedControl';
import type { ProfilesStackScreenProps } from '../navigation/types';
import { useRifleStore } from '../store/useRifleStore';
import { useAmmoStore } from '../store/useAmmoStore';
import { useEnvironmentStore } from '../store/useEnvironmentStore';
import { calculateBallisticSolution } from '../services/ballistics/BallisticCalculator';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

type Props = ProfilesStackScreenProps<'DOPECardGenerator'>;

export function DOPECardGenerator({ route, navigation }: Props) {
  const { rifleId, ammoId } = route.params;
  const { theme } = useTheme();
  const { colors } = theme;

  const { getRifleById } = useRifleStore();
  const { getAmmoById } = useAmmoStore();
  const { current: environment } = useEnvironmentStore();

  const [angularUnit, setAngularUnit] = useState<'MIL' | 'MOA'>('MIL');
  const [distanceUnit, setDistanceUnit] = useState<'yards' | 'meters'>('yards');
  const [minDistance, setMinDistance] = useState(100);
  const [maxDistance, setMaxDistance] = useState(1000);
  const [increment, setIncrement] = useState(100);
  const [windSpeeds] = useState([5, 10, 15, 20]);
  const [generating, setGenerating] = useState(false);

  const rifle = getRifleById(rifleId);
  const ammo = getAmmoById(ammoId);

  // Generate DOPE table data
  const dopeData = useMemo(() => {
    if (!rifle || !ammo || !environment) return [];

    const data: any[] = [];
    for (let distance = minDistance; distance <= maxDistance; distance += increment) {
      const solution = calculateBallisticSolution({
        rifle,
        ammo,
        environment,
        targetDistance: distance,
        angularUnit,
      });

      const windData: { [key: number]: { elevation: number; windage: number } } = {};
      windSpeeds.forEach((windSpeed) => {
        const windSolution = calculateBallisticSolution({
          rifle,
          ammo,
          environment: { ...environment, windSpeed, windDirection: 90 }, // 90° = full value wind
          targetDistance: distance,
          angularUnit,
        });
        windData[windSpeed] = {
          elevation: windSolution.elevationCorrection,
          windage: windSolution.windageCorrection,
        };
      });

      data.push({
        distance,
        elevation: solution.elevationCorrection,
        windData,
        velocity: solution.velocityAtTarget,
        energy: solution.energyAtTarget,
        drop: solution.dropAtTarget,
        tof: solution.timeOfFlight,
      });
    }

    return data;
  }, [rifle, ammo, environment, minDistance, maxDistance, increment, angularUnit, windSpeeds]);

  const generateHTML = () => {
    if (!rifle || !ammo) return '';

    const today = new Date().toLocaleDateString();

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @page {
      size: 3.5in 2in;
      margin: 0.1in;
    }
    body {
      font-family: 'Courier New', monospace;
      font-size: 7pt;
      margin: 0;
      padding: 8px;
      background: white;
      color: black;
    }
    .header {
      text-align: center;
      border-bottom: 1px solid #000;
      padding-bottom: 4px;
      margin-bottom: 4px;
    }
    .title {
      font-weight: bold;
      font-size: 9pt;
      margin-bottom: 2px;
    }
    .subtitle {
      font-size: 6pt;
      margin-bottom: 1px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 6pt;
    }
    th {
      background: #e0e0e0;
      font-weight: bold;
      padding: 2px 1px;
      text-align: center;
      border: 1px solid #000;
    }
    td {
      padding: 2px 1px;
      text-align: center;
      border: 1px solid #666;
    }
    .wind-header {
      font-size: 5pt;
    }
    .footer {
      font-size: 5pt;
      text-align: center;
      margin-top: 4px;
      padding-top: 2px;
      border-top: 1px solid #000;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">DOPE CARD</div>
    <div class="subtitle">${rifle.name} - ${rifle.caliber}</div>
    <div class="subtitle">${ammo.name} (${ammo.bulletWeight}gr ${ammo.bulletType})</div>
    <div class="subtitle">Zero: ${rifle.zeroDistance}${distanceUnit === 'yards' ? 'yd' : 'm'} | MV: ${ammo.muzzleVelocity}fps | ${today}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th rowspan="2">Dist<br/>(${distanceUnit === 'yards' ? 'yd' : 'm'})</th>
        <th rowspan="2">Elev<br/>(${angularUnit})</th>
        <th colspan="${windSpeeds.length}" class="wind-header">Windage @ ${angularUnit} (Full Value)</th>
        <th rowspan="2">Vel<br/>(fps)</th>
      </tr>
      <tr>
        ${windSpeeds.map((ws) => `<th class="wind-header">${ws}mph</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${dopeData
        .map(
          (row) => `
        <tr>
          <td><strong>${row.distance}</strong></td>
          <td><strong>${row.elevation.toFixed(1)}</strong></td>
          ${windSpeeds.map((ws) => `<td>${row.windData[ws].windage.toFixed(1)}</td>`).join('')}
          <td>${Math.round(row.velocity)}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>

  <div class="footer">
    Env: ${environment?.temperature || 59}°F | ${environment?.pressure || 29.92}"Hg | ${environment?.altitude || 0}ft
  </div>
</body>
</html>
    `;
  };

  const handleGeneratePDF = async () => {
    if (!rifle || !ammo) {
      Alert.alert('Error', 'Rifle or ammunition data not found');
      return;
    }

    try {
      setGenerating(true);
      const html = generateHTML();
      const { uri } = await Print.printToFileAsync({ html });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share DOPE Card',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Success', 'DOPE card generated successfully');
      }
    } catch (error) {
      console.error('Error generating DOPE card:', error);
      Alert.alert('Error', 'Failed to generate DOPE card');
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = async () => {
    if (!rifle || !ammo) {
      Alert.alert('Error', 'Rifle or ammunition data not found');
      return;
    }

    try {
      setGenerating(true);
      const html = generateHTML();
      await Print.printAsync({ html });
    } catch (error) {
      console.error('Error printing DOPE card:', error);
      Alert.alert('Error', 'Failed to print DOPE card');
    } finally {
      setGenerating(false);
    }
  };

  if (!rifle || !ammo) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: colors.error }]}>
            Rifle or ammunition profile not found
          </Text>
          <Button title="Go Back" onPress={() => navigation.goBack()} />
        </View>
      </View>
    );
  }

  if (!environment) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: colors.text.primary }]}>
            No environmental data available
          </Text>
          <Text style={[styles.errorSubtext, { color: colors.text.secondary }]}>
            Please set environmental conditions first
          </Text>
          <Button
            title="Set Environment"
            onPress={() => navigation.navigate('EnvironmentInput')}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Configuration Card */}
        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.text.primary }]}>Card Settings</Text>

          <View style={styles.setting}>
            <Text style={[styles.settingLabel, { color: colors.text.secondary }]}>
              Angular Unit
            </Text>
            <SegmentedControl
              options={[
                { label: 'MIL', value: 'MIL' },
                { label: 'MOA', value: 'MOA' },
              ]}
              selectedValue={angularUnit}
              onValueChange={(value) => setAngularUnit(value as 'MIL' | 'MOA')}
            />
          </View>

          <View style={styles.setting}>
            <Text style={[styles.settingLabel, { color: colors.text.secondary }]}>
              Distance Unit
            </Text>
            <SegmentedControl
              options={[
                { label: 'Yards', value: 'yards' },
                { label: 'Meters', value: 'meters' },
              ]}
              selectedValue={distanceUnit}
              onValueChange={(value) => setDistanceUnit(value as 'yards' | 'meters')}
            />
          </View>
        </Card>

        {/* Preview Card */}
        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.text.primary }]}>Preview</Text>
          <View style={[styles.preview, { borderColor: colors.border }]}>
            <View style={styles.previewHeader}>
              <Text style={[styles.previewTitle, { color: colors.text.primary }]}>
                {rifle.name} - {rifle.caliber}
              </Text>
              <Text style={[styles.previewSubtitle, { color: colors.text.secondary }]}>
                {ammo.name} ({ammo.bulletWeight}gr {ammo.bulletType})
              </Text>
            </View>
            <View style={styles.previewTable}>
              <View style={styles.previewTableHeader}>
                <Text style={[styles.previewHeaderCell, { color: colors.text.primary }]}>
                  Dist
                </Text>
                <Text style={[styles.previewHeaderCell, { color: colors.text.primary }]}>
                  Elev
                </Text>
                <Text style={[styles.previewHeaderCell, { color: colors.text.primary }]}>
                  Wind
                </Text>
              </View>
              {dopeData.slice(0, 5).map((row) => (
                <View key={row.distance} style={styles.previewTableRow}>
                  <Text style={[styles.previewCell, { color: colors.text.primary }]}>
                    {row.distance}
                  </Text>
                  <Text style={[styles.previewCell, { color: colors.text.primary }]}>
                    {row.elevation.toFixed(1)}
                  </Text>
                  <Text style={[styles.previewCell, { color: colors.text.primary }]}>
                    {row.windData[10].windage.toFixed(1)}
                  </Text>
                </View>
              ))}
              <Text style={[styles.previewEllipsis, { color: colors.text.secondary }]}>
                ... and {dopeData.length - 5} more rows
              </Text>
            </View>
          </View>
        </Card>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Button
            title={generating ? 'Generating...' : 'Generate PDF'}
            onPress={handleGeneratePDF}
            disabled={generating}
            variant="primary"
            icon={
              generating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : undefined
            }
          />
          <Button
            title="Print"
            onPress={handlePrint}
            disabled={generating}
            variant="secondary"
          />
        </View>
      </ScrollView>
    </View>
  );
}

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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  card: {
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  setting: {
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  preview: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  previewHeader: {
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  previewSubtitle: {
    fontSize: 12,
  },
  previewTable: {
    gap: 4,
  },
  previewTableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.3)',
  },
  previewHeaderCell: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  previewTableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.1)',
  },
  previewCell: {
    flex: 1,
    fontSize: 12,
    textAlign: 'center',
  },
  previewEllipsis: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  actions: {
    gap: 12,
  },
});
