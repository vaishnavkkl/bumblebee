import React from 'react';
import { useTheme } from '../context/ThemeContext';

const RealisticIcon = ({ src, alt, mini }) => {
  return (
    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      <img
        src={src}
        alt={alt}
        style={{ 
          width: '100%', 
          height: mini ? 50 : 160, 
          display: 'block', 
          objectFit: mini ? 'cover' : 'contain', 
          borderRadius: mini ? 0 : 'var(--radius-xl)' 
        }}
      />
    </div>
  );
};

export function BikeIcon({ mini }) {
  const { theme } = useTheme();
  const src = theme === 'dark' ? '/assets/bike-dark.png' : '/assets/bike.png';
  return <RealisticIcon src={src} alt="Bike Icon" mini={mini} />;
}

export function CarIcon({ mini }) {
  const { theme } = useTheme();
  const src = theme === 'dark' ? '/assets/car-dark.png' : '/assets/car.png';
  return <RealisticIcon src={src} alt="Car Icon" mini={mini} />;
}

export function TruckIcon({ mini }) {
  const { theme } = useTheme();
  const src = theme === 'dark' ? '/assets/truck-dark.png' : '/assets/truck.png';
  return <RealisticIcon src={src} alt="Heavy Vehicle Icon" mini={mini} />;
}
