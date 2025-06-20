import styled from 'styled-components';
import { BsMusicNoteBeamed, BsFileEarmarkText } from 'react-icons/bs';
import { MdOutlineLibraryMusic } from 'react-icons/md';
import { HiOutlineMicrophone } from 'react-icons/hi';

export const FormContainer = styled.div`
  margin: 1.5rem auto;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  background: var(--card-background);
  color: var(--text-color);
  transition: all 0.3s ease;
  
  @media (max-width: 768px) {
    padding: 1rem;
    margin: 0.5rem auto;
  }
`;

export const Section = styled.div`
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-color);
  
  h3 {
    margin-bottom: 0.75rem;
    font-weight: 600;
    color: var(--heading-color, var(--text-color));
  }
`;

export const FileInput = styled.input`
  display: none;
`;

export const FilePreviewContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.25rem 0.35rem;
  background-color: var(--card-background, #ffffff);
  border-radius: 6px;
  border: 1px solid var(--border-color);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  overflow: hidden;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
`;

export const FileName = styled.div`
  display: grid;
  align-items: center;
  gap: 0.35rem;
  grid-template-columns: 1fr auto;
  min-width: 0;
  flex: 1;
  font-size: 0.85rem;
  color: var(--text-color);
  overflow: hidden;
  width: 100%;
  box-sizing: border-box;

  span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
    flex: 1;
    padding: 0.15rem 0.4rem;
    background: var(--hover-color, rgba(0, 0, 0, 0.05));
    border-radius: 4px;
    font-size: 0.8rem;
  }
`;

export const CompactFilePreview = styled(FilePreviewContainer)`
  margin: 0;
  padding: 0.25rem 0.35rem;
  background-color: var(--card-background, #ffffff);
  border: 1px solid var(--border-color);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  gap: 0.35rem;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  ${FileName} {
    font-size: 0.8rem;
  }
`;

export const CompactFileGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.25rem;
  width: 100%;
  margin-top: 0.75rem;
`;

export const FileIcon = styled.div<{ type: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  flex-shrink: 0;
  background-color: ${props => {
    switch (props.type) {
      case 'Main':
        return 'rgba(25, 118, 210, 0.15)';
      case 'Music':
        return 'rgba(76, 175, 80, 0.15)';
      case 'Vocals':
        return 'rgba(233, 30, 99, 0.15)';
      case 'Little':
        return 'rgba(156, 39, 176, 0.15)';
      case 'JSON':
        return 'rgba(255, 152, 0, 0.155)';
      default:
        return 'rgba(158, 158, 158, 0.15)';
    }
  }};
  color: ${props => {
    switch (props.type) {
      case 'Main':
        return '#1976D2';
      case 'Music':
        return '#4CAF50';
      case 'Vocals':
        return '#E91E63';
      case 'Little':
        return '#9C27B0';
      case 'JSON':
        return '#FF9800';
      default:
        return '#9E9E9E';
    }
  }};
  font-size: 1rem;
`;

export const FileTypeTag = styled.span`
  padding: 0.15rem 0.35rem;
  border-radius: 12px;
  font-size: 0.6rem;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
  background-color: var(--accent-background, rgba(25, 118, 210, 0.1));
  color: var(--accent-text-color, #1976D2);
  letter-spacing: 0.4px;
  text-transform: uppercase;
`;

export const CompactFileTag = styled(FileTypeTag)<{ status?: 'success' | 'error' }>`
  padding: 0.1rem 0.3rem;
  font-size: 0.55rem;
  border-radius: 10px;
  background-color: ${props => {
    switch (props.children) {
      case 'Main':
        return 'rgba(25, 118, 210, 0.2)';
      case 'Music':
        return 'rgba(76, 175, 80, 0.2)';
      case 'Vocals':
        return 'rgba(233, 30, 99, 0.2)';
      case 'Little':
        return 'rgba(156, 39, 176, 0.2)';
      case 'JSON':
        return 'rgba(255, 152, 0, 0.2)';
      default:
        return 'rgba(158, 158, 158, 0.2)';
    }
  }};
  color: ${props => {
    switch (props.status) {
      case 'success':
        return '#4CAF50';
      case 'error':
        return '#F44336';
      default:
        return props.children === 'Main' ? '#1976D2' :
               props.children === 'Music' ? '#4CAF50' :
               props.children === 'Vocals' ? '#E91E63' :
               props.children === 'Little' ? '#9C27B0' :
               props.children === 'JSON' ? '#FF9800' :
               props.children === 'Square' ? '#009688' :
               '#9E9E9E';
    }
    switch (props.children) {
      case 'Main':
        return '#1976D2';
      case 'Music':
        return '#4CAF50';
      case 'Vocals':
        return '#E91E63';
      case 'Little':
        return '#9C27B0';
      case 'JSON':
        return '#FF9800';
      default:
        return '#9E9E9E';
    }
  }};
  margin-left: 0.25rem;
  padding: 0.1rem 0.3rem;
  font-size: 0.55rem;
  border-radius: 10px;
  background-color: ${props => {
    switch (props.status) {
      case 'success':
        return 'rgba(76, 175, 80, 0.2)';
      case 'error':
        return 'rgba(244, 67, 54, 0.2)';
      default:
        return 'transparent';
    }
  }};
`;

export const DropZone = styled.div<{ isDragging?: boolean }>`
  width: 100%;
  padding: 1rem;
  margin: 0.5rem 0 1rem;
  border: 2px dashed ${props => props.isDragging ? 'var(--accent-color)' : 'var(--border-color)'};
  border-radius: 8px;
  background-color: ${props => props.isDragging ? 'var(--hover-color)' : 'transparent'};
  color: var(--text-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;

  &:hover {
    border-color: var(--accent-color);
    background-color: var(--hover-color);
    transform: translateY(-2px);
  }
  
  &:after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: ${props => props.isDragging ? 'rgba(var(--accent-color-rgb), 0.05)' : 'transparent'};
    z-index: 0;
    transition: all 0.3s ease;
  }
  
  > * {
    position: relative;
    z-index: 1;
  }

  ${FilePreviewContainer} {
    width: 100%;
    margin: 0.5rem 0 0;
  }
`;

export const BulkDropZone = styled(DropZone)`
  background-color: rgba(110, 142, 251, 0.05);
  border: 3px dashed #6e8efb;
  padding: 2rem 1.5rem;
  margin-bottom: 1.5rem;
  margin-top: 1rem;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);

  &:hover {
    background-color: rgba(110, 142, 251, 0.1);
    transform: translateY(-4px);
    box-shadow: 0 8px 20px rgba(110, 142, 251, 0.15);
  }
  
  .upload-icon {
    font-size: 2rem;
    color: #6e8efb;
    margin-bottom: 0.75rem;
    opacity: 0.8;
  }
`;

export const PreviewImage = styled.img`
  width: 50px;
  height: 50px;
  object-fit: cover;
  border-radius: 6px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
  flex-shrink: 0;
  
  &:hover {
    transform: scale(1.05);
  }
`;

export const Button = styled.button`
  background: linear-gradient(135deg, var(--accent-color) 0%, var(--accent-color-secondary) 100%);
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  margin-top: 0.75rem;
  width: 100%;
  font-weight: 600;
  font-size: 0.95rem;
  letter-spacing: 0.5px;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  position: relative;
  overflow: hidden;

  &:before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: all 0.6s ease;
  }

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 7px 14px rgba(0, 0, 0, 0.18);
    
    &:before {
      left: 100%;
    }
  }

  &:active {
    transform: translateY(-1px);
  }

  &:disabled {
    background: var(--disabled-color);
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

export const InfoBox = styled.div`
  background-color: var(--info-background, rgba(25, 118, 210, 0.05));
  border-left: 4px solid var(--accent-color, #1976D2);
  padding: 1rem;
  margin: 1rem 0;
  border-radius: 8px;
  color: var(--text-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
  
  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  
  ul {
    margin-top: 0.5rem;
    padding-left: 1.25rem;
    
    li {
      margin-bottom: 0.5rem;
    }
  }
  
  strong {
    color: var(--accent-color, #1976D2);
  }
`;

export const CodeExample = styled.pre`
  background-color: var(--code-background, #2d2d2d);
  padding: 1.25rem;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 0.9rem;
  margin: 0.75rem 0;
  color: var--code-text-color, #f8f8f2);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
`;

export const DropText = styled.p`
  margin: 0;
  text-align: center;
  color: var(--text-color);
  font-size: 0.9rem;
  
  svg {
    font-size: 1.25rem;
    margin-bottom: 0.5rem;
    color: var--accent-color);
  }
`;

export const ErrorMessage = styled.div`
  color: var(--error-color, #f44336);
  margin-top: 1.25rem;
  padding: 1rem;
  background-color: var(--error-background, rgba(244, 67, 54, 0.08));
  border-radius: 8px;
  border-left: 4px solid var(--error-color, #f44336);
  font-size: 0.95rem;
  animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
  
  @keyframes shake {
    10%, 90% { transform: translateX(-1px); }
    20%, 80% { transform: translateX(2px); }
    30%, 50%, 70% { transform: translateX(-3px); }
    40%, 60% { transform: translateX(3px); }
  }
`;

export const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 1rem;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

export const FormGridWide = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
  
  @media (max-width: 768px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

export const BackgroundGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  width: 100%;
  
  /* Keep existing mobile styles */
  @media (max-width: 768px) {
    grid-template-columns: minmax(0, 1fr);
  }

  > div {
    min-width: 0;
    width: 100%;
  }

  ${FilePreviewContainer} {
    width: 100%;
    flex-wrap: nowrap;
    box-sizing: border-box;
  }
`;

export const FormTitle = styled.h2`
  font-size: 1.8rem;
  color: var(--heading-color, var(--text-color));
  margin-bottom: 1.5rem;
  font-weight: 600;
  border-bottom: 2px solid var(--accent-color);
  padding-bottom: 0.75rem;
  display: inline-block;
`;

export const AnimatedIcon = styled.div`
  svg {
    transition: all 0.3s ease;
  }
  
  &:hover svg {
    transform: scale(1.2);
  }
`;