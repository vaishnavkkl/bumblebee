import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, shadows } from '../../constants/theme';

type TabIconProps = {
  focused: boolean;
  color: string;
  activeIcon: keyof typeof Ionicons.glyphMap;
  inactiveIcon: keyof typeof Ionicons.glyphMap;
  label: string;
};

function TabIcon({ focused, color, activeIcon, inactiveIcon, label }: TabIconProps) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons
        name={focused ? activeIcon : inactiveIcon}
        size={focused ? 18 : 20}
        color={focused ? colors.accent : color}
      />
      {focused && <Text style={styles.activeLabel} numberOfLines={1}>{label}</Text>}
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSubtle,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderColor: '#E2E8F0',
          height: 60 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
          paddingHorizontal: 6,
        },
        tabBarShowLabel: false,
        tabBarLabelStyle: {
          fontSize: 9,
          lineHeight: 12,
          fontWeight: '800',
          marginTop: 1,
        },
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color} label="Home" activeIcon="home" inactiveIcon="home-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="queue"
        options={{
          title: 'Wash Queue',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color} label="Queue" activeIcon="car" inactiveIcon="car-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="billing"
        options={{
          title: 'Billing',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color} label="Bill" activeIcon="receipt" inactiveIcon="receipt-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: 'Finance',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color} label="Money" activeIcon="wallet" inactiveIcon="wallet-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="employees"
        options={{
          title: 'Employees',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color} label="Team" activeIcon="people" inactiveIcon="people-outline" />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    minWidth: 46,
    minHeight: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.accentGlass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accentBorder,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    paddingHorizontal: 8,
  },
  activeLabel: {
    color: colors.accent,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '900',
    marginTop: 1,
  },
});
