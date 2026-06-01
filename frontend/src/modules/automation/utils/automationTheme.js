import * as Blockly from 'blockly';

export const AutomationTheme = Blockly.Theme.defineTheme('automation_dark', {
  'base': Blockly.Themes.Classic,
  'blockStyles': {
    'event_blocks': {
      'colourPrimary': '#EAB308',
      'colourSecondary': '#CA8A04',
      'colourTertiary': '#A16207'
    },
    'control_blocks': {
      'colourPrimary': '#A855F7',
      'colourSecondary': '#9333EA',
      'colourTertiary': '#7E22CE'
    },
    'action_blocks': {
      'colourPrimary': '#22C55E',
      'colourSecondary': '#16A34A',
      'colourTertiary': '#15803D'
    },
    'sensor_blocks': {
      'colourPrimary': '#3B82F6',
      'colourSecondary': '#2563EB',
      'colourTertiary': '#1D4ED8'
    }
  },
  'categoryStyles': {
    'event_category': {
      'colour': '#EAB308'
    },
    'control_category': {
      'colour': '#A855F7'
    },
    'action_category': {
      'colour': '#22C55E'
    },
    'sensor_category': {
      'colour': '#3B82F6'
    }
  },
  'componentStyles': {
    'workspaceBackgroundColour': '#0f172a', // Slate 900
    'toolboxBackgroundColour': '#1e293b', // Slate 800
    'toolboxForegroundColour': '#f8fafc', // Slate 50
    'flyoutBackgroundColour': '#1e293b',
    'flyoutForegroundColour': '#f8fafc',
    'insertionMarkerColour': '#fff',
    'insertionMarkerOpacity': 0.3,
    'scrollbarColour': '#475569', // Slate 600
    'scrollbarOpacity': 0.4,
    'cursorColour': '#d1d5db',
    'blackBackground': '#000'
  },
  'fontStyle': {
    'family': '"Inter", "Roboto", sans-serif',
    'weight': '500',
    'size': 12
  }
});
