/**
 * @protocolbanks/react - Component Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  CheckoutProvider,
  PaymentButton,
  ChainSelector,
  TokenSelector,
} from '../src';

// Mock the SDK
jest.mock('@protocolbanks/sdk', () => ({
  ProtocolBanksClient: jest.fn().mockImplementation(() => ({
    links: {
      generate: jest.fn().mockReturnValue({
        url: 'https://pay.protocolbanks.com/test',
        id: 'link_123',
      }),
      getSupportedChains: jest.fn().mockReturnValue([1, 137, 8453]),
      getSupportedTokens: jest.fn().mockReturnValue(['USDC', 'USDT', 'ETH']),
    },
    checkout: {
      createSession: jest.fn().mockResolvedValue({
        sessionId: 'session_123',
        url: 'https://checkout.protocolbanks.com/session_123',
      }),
    },
  })),
}));

describe('CheckoutProvider', () => {
  it('should render children', () => {
    render(
      <CheckoutProvider apiKey="pk_test_123">
        <div data-testid="child">Child Content</div>
      </CheckoutProvider>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('should throw without apiKey', () => {
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(
        <CheckoutProvider apiKey="">
          <div>Child</div>
        </CheckoutProvider>
      );
    }).toThrow();

    consoleSpy.mockRestore();
  });
});

describe('PaymentButton', () => {
  const defaultProps = {
    amount: '100',
    recipientAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f5bE21',
    token: 'USDC' as const,
    onSuccess: jest.fn(),
  };

  it('should render with default text', () => {
    render(
      <CheckoutProvider apiKey="pk_test_123">
        <PaymentButton {...defaultProps} />
      </CheckoutProvider>
    );

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should render with custom text', () => {
    render(
      <CheckoutProvider apiKey="pk_test_123">
        <PaymentButton {...defaultProps}>Pay Now</PaymentButton>
      </CheckoutProvider>
    );

    expect(screen.getByText('Pay Now')).toBeInTheDocument();
  });

  it('should be disabled when disabled prop is true', () => {
    render(
      <CheckoutProvider apiKey="pk_test_123">
        <PaymentButton {...defaultProps} disabled />
      </CheckoutProvider>
    );

    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should apply variant styles', () => {
    const { rerender } = render(
      <CheckoutProvider apiKey="pk_test_123">
        <PaymentButton {...defaultProps} variant="minimal" />
      </CheckoutProvider>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveClass('pb-button-minimal');

    rerender(
      <CheckoutProvider apiKey="pk_test_123">
        <PaymentButton {...defaultProps} variant="branded" />
      </CheckoutProvider>
    );

    expect(screen.getByRole('button')).toHaveClass('pb-button-branded');
  });

  it('should call onClick handler', () => {
    const onClick = jest.fn();
    render(
      <CheckoutProvider apiKey="pk_test_123">
        <PaymentButton {...defaultProps} onClick={onClick} />
      </CheckoutProvider>
    );

    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });
});

describe('ChainSelector', () => {
  it('should render chain options', () => {
    const onChange = jest.fn();
    render(
      <CheckoutProvider apiKey="pk_test_123">
        <ChainSelector
          selectedChain={1}
          onChange={onChange}
          chains={[1, 137, 8453]}
        />
      </CheckoutProvider>
    );

    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('should call onChange when selection changes', () => {
    const onChange = jest.fn();
    render(
      <CheckoutProvider apiKey="pk_test_123">
        <ChainSelector
          selectedChain={1}
          onChange={onChange}
          chains={[1, 137, 8453]}
        />
      </CheckoutProvider>
    );

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '137' } });
    expect(onChange).toHaveBeenCalledWith(137);
  });
});

describe('TokenSelector', () => {
  it('should render token options', () => {
    const onChange = jest.fn();
    render(
      <CheckoutProvider apiKey="pk_test_123">
        <TokenSelector
          selectedToken="USDC"
          onChange={onChange}
          tokens={['USDC', 'USDT', 'ETH']}
        />
      </CheckoutProvider>
    );

    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('should call onChange when selection changes', () => {
    const onChange = jest.fn();
    render(
      <CheckoutProvider apiKey="pk_test_123">
        <TokenSelector
          selectedToken="USDC"
          onChange={onChange}
          tokens={['USDC', 'USDT', 'ETH']}
        />
      </CheckoutProvider>
    );

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'USDT' } });
    expect(onChange).toHaveBeenCalledWith('USDT');
  });
});
