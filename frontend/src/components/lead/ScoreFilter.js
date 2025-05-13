import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Slider,
  Stack,
  Typography,
} from '@mui/material';

/**
 * Component for filtering leads by score range
 */
const ScoreFilter = ({ onChange, initialValues = [0, 100] }) => {
  const [scoreRange, setScoreRange] = useState(initialValues);
  
  // Update filter when the score range changes
  useEffect(() => {
    // Call the onChange handler with the current range
    if (onChange) {
      onChange({
        minScore: scoreRange[0],
        maxScore: scoreRange[1]
      });
    }
  }, [scoreRange, onChange]);
  
  // Handle slider change
  const handleScoreChange = (event, newValue) => {
    setScoreRange(newValue);
  };
  
  return (
    <Card>
      <CardHeader title="Score Filter" />
      <Divider />
      <CardContent>
        <Box sx={{ mt: 2, mx: 2 }}>
          <Typography gutterBottom>Score Range</Typography>
          <Slider
            value={scoreRange}
            onChange={handleScoreChange}
            valueLabelDisplay="auto"
            min={0}
            max={100}
            step={5}
            marks={[
              { value: 0, label: '0' },
              { value: 20, label: '20' },
              { value: 40, label: '40' },
              { value: 60, label: '60' },
              { value: 80, label: '80' },
              { value: 100, label: '100' }
            ]}
          />
          
          <Stack 
            direction="row" 
            justifyContent="space-between" 
            sx={{ mt: 2 }}
          >
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                Min Score
              </Typography>
              <Typography variant="body1">
                {scoreRange[0]}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                Max Score
              </Typography>
              <Typography variant="body1">
                {scoreRange[1]}
              </Typography>
            </Box>
          </Stack>
          
          <Box sx={{ mt: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Score Ranges Guide:
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
              <Typography variant="caption" color="error">0-20: Poor</Typography>
              <Typography variant="caption" color="warning.main">20-40: Below Average</Typography>
              <Typography variant="caption" color="warning.light">40-60: Average</Typography>
              <Typography variant="caption" color="success.light">60-80: Good</Typography>
              <Typography variant="caption" color="success.main">80-100: Excellent</Typography>
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default ScoreFilter; 