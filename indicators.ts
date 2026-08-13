export type IndicatorKind = 'microphone' | 'volume' | 'bluetooth' | 'network' | 'power' | 'powerProfiles';

export type QSField = '_volumeInput' | '_volumeOutput' | '_bluetooth' | '_network' | '_powerProfiles' | '_system';

export interface IndicatorRow {
  kind: IndicatorKind;
  settingKey: string;
  qsField: QSField;
  title: string;
  subtitle: string;
  since: number;
  required: boolean;
}

const N_ = (s: string): string => s;

export const INDICATORS: readonly IndicatorRow[] = [
  {
    kind: 'microphone',
    settingKey: 'hide-microphone',
    qsField: '_volumeInput',
    title: N_('Hide microphone'),
    subtitle: N_('Hide the microphone indicator.'),
    since: 45,
    required: false,
  },
  {
    kind: 'volume',
    settingKey: 'hide-volume',
    qsField: '_volumeOutput',
    title: N_('Hide volume'),
    subtitle: N_('Hide the volume indicator.'),
    since: 45,
    required: true,
  },
  {
    kind: 'bluetooth',
    settingKey: 'hide-bluetooth',
    qsField: '_bluetooth',
    title: N_('Hide Bluetooth'),
    subtitle: N_('Hide the Bluetooth indicator.'),
    since: 45,
    required: false,
  },
  {
    kind: 'network',
    settingKey: 'hide-network',
    qsField: '_network',
    title: N_('Hide network'),
    subtitle: N_('Hide the network indicator.'),
    since: 45,
    required: false,
  },
  {
    kind: 'powerProfiles',
    settingKey: 'hide-power-profiles',
    qsField: '_powerProfiles',
    title: N_('Hide power profiles'),
    subtitle: N_('Hide the power profiles indicator.'),
    since: 45,
    required: false,
  },
  {
    kind: 'power',
    settingKey: 'hide-power',
    qsField: '_system',
    title: N_('Hide power'),
    subtitle: N_('Hide the power indicator.'),
    since: 45,
    required: true,
  },
];
