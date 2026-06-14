import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const BREAKPOINTS = {
  compact: 360,
  phone: 600,
  tablet: 768,
  largeTablet: 1024,
};

export function useDeviceLayout() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return useMemo(() => {
    const isSmall = width < BREAKPOINTS.compact;
    const isTablet = width >= BREAKPOINTS.tablet;
    const isLargeTablet = width >= BREAKPOINTS.largeTablet;
    const isLandscape = width > height;

    return {
      width,
      height,
      isSmall,
      isTablet,
      isLargeTablet,
      isLandscape,
      horizontalPadding: isTablet ? 32 : isSmall ? 12 : 16,
      maxContentWidth: isLargeTablet ? 1040 : isTablet ? 820 : undefined,
      columns: width >= BREAKPOINTS.largeTablet ? 3 : isTablet ? 2 : 1,
      insets,
      contentTopPadding: Math.max(insets.top, 16),
      contentBottomPadding: Math.max(insets.bottom, 10) + 104,
    };
  }, [height, insets, width]);
}
