import styled from 'styled-components';

export const Input = styled.input`
  width: 100%;
  padding: 0.85rem 1rem;
  margin: 0.5rem 0 1.25rem;
  border: 1px solid var(--input-border);
  border-radius: 8px;
  background-color: var(--input-background);
  color: var(--text-color);
  font-size: 1rem;
  transition: all 0.3s ease;
  
  &:focus {
    outline: none;
    border-color: var(--accent-color);
    box-shadow: 0 0 0 2px rgba(var(--accent-color-rgb), 0.2);
  }
  
  &::placeholder {
    color: var(--text-color);
    opacity: 0.5;
  }
  
  &:disabled {
    background-color: var(--disabled-color);
    cursor: not-allowed;
  }
`;

export const Select = styled.select`
  width: 100%;
  padding: 0.85rem 1rem;
  margin: 0.5rem 0 1.25rem;
  border: 1px solid var(--input-border);
  border-radius: 8px;
  background-color: var(--input-background);
  color: var(--text-color);
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 1rem center;
  background-size: 1rem;
  
  &:focus {
    outline: none;
    border-color: var(--accent-color);
    box-shadow: 0 0 0 2px rgba(var(--accent-color-rgb), 0.2);
  }
  
  &:disabled {
    background-color: var(--disabled-color);
    cursor: not-allowed;
  }
`;

export const TextArea = styled.textarea`
  width: 100%;
  padding: 0.85rem 1rem;
  margin: 0.5rem 0 1.25rem;
  border: 1px solid var(--input-border);
  border-radius: 8px;
  background-color: var(--input-background);
  color: var(--text-color);
  font-size: 1rem;
  min-height: 100px;
  resize: vertical;
  transition: all 0.3s ease;
  
  &:focus {
    outline: none;
    border-color: var(--accent-color);
    box-shadow: 0 0 0 2px rgba(var(--accent-color-rgb), 0.2);
  }
  
  &::placeholder {
    color: var(--text-color);
    opacity: 0.5;
  }
`;

export const InputLabel = styled.label`
  font-weight: 500;
  display: block;
  margin-bottom: 0.5rem;
  color: var(--heading-color);
`;

export const Button = styled.button`
  background: linear-gradient(135deg, var(--accent-color), var(--accent-color-secondary));
  color: white;
  padding: 0.85rem 1.75rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 1rem;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 7px 14px rgba(0, 0, 0, 0.12);
  }
  
  &:active {
    transform: translateY(0);
  }
  
  &:disabled {
    background: var(--disabled-color);
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
  
  svg {
    margin-right: 0.5rem;
  }
`;

export const SecondaryButton = styled(Button)`
  background: transparent;
  color: var(--accent-color);
  border: 1px solid var(--accent-color);
  
  &:hover {
    background-color: var(--hover-color);
  }
`;

export const Card = styled.div`
  background: var(--card-background);
  border-radius: 12px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.07);
  padding: 1.5rem;
  transition: all 0.3s ease;
  
  &:hover {
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
  }
`;

export const Badge = styled.span<{ variant?: 'default' | 'success' | 'error' | 'warning' | 'info' }>`
  display: inline-block;
  padding: 0.35rem 0.75rem;
  border-radius: 16px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  
  ${({ variant = 'default' }) => {
    switch (variant) {
      case 'success':
        return `
          background-color: var(--success-background);
          color: var(--success-color);
        `;
      case 'error':
        return `
          background-color: var(--error-background);
          color: var(--error-color);
        `;
      case 'warning':
        return `
          background-color: var(--warning-background);
          color: var(--warning-color);
        `;
      case 'info':
        return `
          background-color: var(--info-background);
          color: var(--accent-color);
        `;
      default:
        return `
          background-color: var(--hover-color);
          color: var(--text-color);
        `;
    }
  }}
`;

export const Divider = styled.hr`
  border: none;
  height: 1px;
  background-color: var(--border-color);
  margin: 1.5rem 0;
`;

export const Grid = styled.div<{ columns?: number; gap?: string }>`
  display: grid;
  grid-template-columns: repeat(${({ columns = 1 }) => columns}, 1fr);
  gap: ${({ gap = '1rem' }) => gap};
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

export const Flex = styled.div<{ justify?: string; align?: string; gap?: string; direction?: string }>`
  display: flex;
  justify-content: ${({ justify = 'flex-start' }) => justify};
  align-items: ${({ align = 'center' }) => align};
  gap: ${({ gap = '1rem' }) => gap};
  flex-direction: ${({ direction = 'row' }) => direction};
  
  @media (max-width: 768px) {
    flex-direction: ${({ direction = 'row' }) => direction === 'row' ? 'column' : direction};
  }
`;

export const Tooltip = styled.div`
  position: relative;
  display: inline-block;
  
  &:hover::before {
    content: attr(data-tooltip);
    position: absolute;
    bottom: 125%;
    left: 50%;
    transform: translateX(-50%);
    padding: 0.5rem 0.75rem;
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    border-radius: 4px;
    font-size: 0.8rem;
    white-space: nowrap;
    z-index: 10;
  }
  
  &:hover::after {
    content: '';
    position: absolute;
    top: -5px;
    left: 50%;
    transform: translateX(-50%);
    border-width: 5px;
    border-style: solid;
    border-color: rgba(0, 0, 0, 0.8) transparent transparent transparent;
  }
`;

export const AlertBox = styled.div<{ variant?: 'info' | 'success' | 'warning' | 'error' }>`
  padding: 1rem;
  margin: 1rem 0;
  border-radius: 8px;
  
  ${({ variant = 'info' }) => {
    switch (variant) {
      case 'success':
        return `
          background-color: var(--success-background);
          border-left: 4px solid var(--success-color);
        `;
      case 'warning':
        return `
          background-color: var(--warning-background);
          border-left: 4px solid var(--warning-color);
        `;
      case 'error':
        return `
          background-color: var(--error-background);
          border-left: 4px solid var(--error-color);
        `;
      default:
        return `
          background-color: var(--info-background);
          border-left: 4px solid var(--accent-color);
        `;
    }
  }}
`;

export const ProgressBar = styled.div<{ progress: number; color?: string }>`
  width: 100%;
  height: 8px;
  background-color: var(--hover-color);
  border-radius: 4px;
  overflow: hidden;
  
  &::after {
    content: '';
    display: block;
    height: 100%;
    width: ${({ progress }) => `${progress}%`};
    background-color: ${({ color }) => color || 'var(--accent-color)'};
    transition: width 0.3s ease;
  }
`;

export const Avatar = styled.div<{ size?: string; src?: string }>`
  width: ${({ size = '40px' }) => size};
  height: ${({ size = '40px' }) => size};
  border-radius: 50%;
  background-color: var(--hover-color);
  background-image: ${({ src }) => src ? `url(${src})` : 'none'};
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-color);
  font-weight: 600;
`;

export const Spinner = styled.div`
  width: 30px;
  height: 30px;
  border: 3px solid rgba(var(--accent-color-rgb), 0.1);
  border-radius: 50%;
  border-top-color: var(--accent-color);
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

export const Tab = styled.button<{ $active?: boolean }>`
  padding: 0.75rem 1.5rem;
  border: none;
  background: none;
  border-bottom: 2px solid ${({ $active }) => $active ? 'var(--accent-color)' : 'transparent'};
  color: ${({ $active }) => $active ? 'var(--accent-color)' : 'var(--text-color)'};
  font-weight: ${({ $active }) => $active ? '600' : '400'};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: var(--hover-color);
  }
`;

export const TabContainer = styled.div`
  display: flex;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 1.5rem;
  overflow-x: auto;
  scrollbar-width: none;
  
  &::-webkit-scrollbar {
    display: none;
  }
`;

export const FileChip = styled.div`
  display: flex;
  align-items: center;
  background-color: var(--hover-color);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  margin: 0.5rem 0;
  
  .filename {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-right: 0.5rem;
  }
  
  button {
    background: none;
    border: none;
    color: var(--error-color);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 50%;
    
    &:hover {
      background-color: var(--hover-color-darker);
    }
  }
`;

export const Switch = styled.label`
  position: relative;
  display: inline-block;
  width: 48px;
  height: 24px;
  
  input {
    opacity: 0;
    width: 0;
    height: 0;
    
    &:checked + span {
      background-color: var(--accent-color);
    }
    
    &:checked + span:before {
      transform: translateX(24px);
    }
    
    &:focus + span {
      box-shadow: 0 0 1px var(--accent-color);
    }
  }
  
  span {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--hover-color-darker);
    transition: .3s;
    border-radius: 34px;
    
    &:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: .3s;
      border-radius: 50%;
    }
  }
`;