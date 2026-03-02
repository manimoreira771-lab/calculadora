import React, { useEffect } from 'react';
import { injectSpeedInsights } from '@vercel/speed-insights';

/**
 * SpeedInsights Component
 * 
 * Integrates Vercel Speed Insights into the application.
 * For Vite/React projects, this component injects the Speed Insights tracking script.
 * 
 * Usage: Include <SpeedInsights /> in your root component or layout.
 */
const SpeedInsights: React.FC = () => {
  useEffect(() => {
    // Inject the Speed Insights tracking script on component mount
    injectSpeedInsights();
  }, []);

  return null; // This component doesn't render any visible UI
};

export default SpeedInsights;
