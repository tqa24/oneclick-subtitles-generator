import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import '../../../styles/narration/subtitleGroupingModal.css';

/**
 * Modal component to display a comparison between original subtitles and grouped subtitles
 * @param {Object} props - Component props
 * @param {boolean} props.open - Whether the modal is open
 * @param {Function} props.onClose - Function to close the modal
 * @param {Array} props.originalSubtitles - Original subtitle objects
 * @param {Array} props.groupedSubtitles - Grouped subtitle objects
 * @returns {JSX.Element} - Rendered component
 */
const SubtitleGroupingModal = ({ open, onClose, originalSubtitles, groupedSubtitles }) => {
  const { t } = useTranslation();
  const [groupedSubtitleMap, setGroupedSubtitleMap] = useState({});
  const [tableData, setTableData] = useState([]);

  // Process the subtitles to create the table data
  useEffect(() => {
    if (!originalSubtitles || !groupedSubtitles) return;

    // Create a map of grouped subtitles by their original IDs
    const groupMap = {};
    groupedSubtitles.forEach(group => {
      if (group.original_ids) {
        group.original_ids.forEach(id => {
          groupMap[id] = group;
        });
      }
    });
    setGroupedSubtitleMap(groupMap);

    // Create the table data
    const data = originalSubtitles.map(subtitle => {
      const id = subtitle.subtitle_id || subtitle.id;
      return {
        original: subtitle,
        grouped: groupMap[id] || null
      };
    });
    setTableData(data);
  }, [originalSubtitles, groupedSubtitles]);

  // Function to get the row span for a grouped subtitle
  const getRowSpan = (groupedSubtitle) => {
    if (!groupedSubtitle || !groupedSubtitle.original_ids) return 1;
    return groupedSubtitle.original_ids.length;
  };

  // Function to determine if a cell should be rendered
  const shouldRenderCell = (index, groupedSubtitle) => {
    if (!groupedSubtitle || !groupedSubtitle.original_ids) return true;

    // Only render the cell for the first occurrence of this grouped subtitle
    const originalId = tableData[index].original.subtitle_id || tableData[index].original.id;
    const firstId = groupedSubtitle.original_ids[0];
    return originalId === firstId;
  };

  // Format time (seconds) to MM:SS.mmm
  const formatTime = (seconds) => {
    if (seconds === undefined || seconds === null) return '';

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);

    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      aria-labelledby="subtitle-grouping-dialog-title"
    >
      <DialogTitle id="subtitle-grouping-dialog-title">
        {t('narration.subtitleGroupingTitle', 'Subtitle Grouping Comparison')}
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" paragraph>
          {t('narration.subtitleGroupingExplanation', 'This table shows how the original subtitles have been grouped into fuller sentences for better narration. Each row on the left represents an original subtitle, while the merged cells on the right show how they have been combined.')}
        </Typography>
        <Box sx={{ mt: 2 }}>
          <TableContainer component={Paper} sx={{ maxHeight: 500 }}>
            <Table stickyHeader aria-label="subtitle grouping table">
              <TableHead>
                <TableRow>
                  <TableCell width="5%" className="id-cell">{t('narration.id', 'ID')}</TableCell>
                  <TableCell width="10%" className="time-cell">{t('narration.time', 'Time')}</TableCell>
                  <TableCell width="35%">{t('narration.originalSubtitles', 'Original Subtitles')}</TableCell>
                  <TableCell width="5%" className="id-cell">{t('narration.groupId', 'Group')}</TableCell>
                  <TableCell width="10%" className="time-cell">{t('narration.groupTime', 'Group Time')}</TableCell>
                  <TableCell width="35%">{t('narration.groupedSubtitles', 'Grouped Subtitles')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tableData.map((row, index) => (
                  <TableRow
                    key={row.original.subtitle_id || row.original.id || index}
                    className={index % 2 === 0 ? 'original-subtitle' : ''}
                  >
                    <TableCell className="id-cell">{row.original.subtitle_id || row.original.id}</TableCell>
                    <TableCell className="time-cell">{formatTime(row.original.start)} - {formatTime(row.original.end)}</TableCell>
                    <TableCell>{row.original.text}</TableCell>
                    {shouldRenderCell(index, row.grouped) ? (
                      <>
                        <TableCell className="id-cell grouped-subtitle" rowSpan={getRowSpan(row.grouped)}>
                          {row.grouped ? (row.grouped.subtitle_id || row.grouped.id) : '-'}
                        </TableCell>
                        <TableCell className="time-cell grouped-subtitle" rowSpan={getRowSpan(row.grouped)}>
                          {row.grouped ? `${formatTime(row.grouped.start)} - ${formatTime(row.grouped.end)}` : '-'}
                        </TableCell>
                        <TableCell className="grouped-subtitle" rowSpan={getRowSpan(row.grouped)}>
                          {row.grouped ? row.grouped.text : '-'}
                        </TableCell>
                      </>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          {t('common.close', 'Close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SubtitleGroupingModal;
