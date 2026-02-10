import { describe, expect, test } from 'vitest'
import { MarkerParser, formatMarker } from '../utils/result-upload/MarkerParser'

const junit = new MarkerParser('junit-upload')
const playwright = new MarkerParser('playwright-json-upload')

describe('formatMarker', () => {
	test('pads sequence to 3 digits', () => {
		expect(formatMarker('TEST', 2)).toBe('TEST-002')
		expect(formatMarker('PRJ', 42)).toBe('PRJ-042')
	})

	test('does not pad sequences with 3+ digits', () => {
		expect(formatMarker('TEST', 123)).toBe('TEST-123')
		expect(formatMarker('TEST', 1234)).toBe('TEST-1234')
	})

	test('instance method matches standalone function', () => {
		expect(junit.formatMarker('ABC', 7)).toBe(formatMarker('ABC', 7))
	})
})

describe('detectProjectCode', () => {
	describe('hyphenated markers (all formats)', () => {
		test('at start of name', () => {
			expect(junit.detectProjectCode('TEST-002 Cart items')).toBe('TEST')
			expect(playwright.detectProjectCode('TEST-002 Cart items')).toBe('TEST')
		})

		test('at end of name', () => {
			expect(junit.detectProjectCode('Cart items TEST-002')).toBe('TEST')
			expect(playwright.detectProjectCode('Cart items TEST-002')).toBe('TEST')
		})

		test('in middle of name', () => {
			expect(junit.detectProjectCode('Some TEST-002 thing')).toBe('TEST')
			expect(playwright.detectProjectCode('Some TEST-002 thing')).toBe('TEST')
		})

		test('with alphanumeric project code', () => {
			expect(junit.detectProjectCode('BD026-123 something')).toBe('BD026')
		})
	})

	describe('separator-bounded hyphenless (JUnit only)', () => {
		test('underscore-separated', () => {
			expect(junit.detectProjectCode('test_test002_cart')).toBe('TEST')
		})

		test('returns null for Playwright', () => {
			expect(playwright.detectProjectCode('test_test002_cart')).toBeNull()
		})

		test('requires name starting with "test"', () => {
			expect(junit.detectProjectCode('check_test002_cart')).toBeNull()
		})

		test('case-insensitive project code', () => {
			expect(junit.detectProjectCode('test_bd026_cart')).toBe('BD')
		})
	})

	describe('camelCase start (JUnit only)', () => {
		test('marker after Test prefix', () => {
			expect(junit.detectProjectCode('TestTest002CartItems')).toBe('TEST')
		})

		test('returns null for Playwright', () => {
			expect(playwright.detectProjectCode('TestTest002CartItems')).toBeNull()
		})

		test('marker at end of string', () => {
			expect(junit.detectProjectCode('TestBd026')).toBe('BD')
		})

		test('requires name starting with "test"', () => {
			expect(junit.detectProjectCode('CheckTest002CartItems')).toBeNull()
		})
	})

	describe('camelCase end (JUnit only)', () => {
		test('marker at end of name', () => {
			expect(junit.detectProjectCode('TestCartItemsTest002')).toBe('TEST')
		})

		test('returns null for Playwright', () => {
			expect(playwright.detectProjectCode('TestCartItemsTest002')).toBeNull()
		})

		test('all-uppercase without separator matches via separator pattern', () => {
			expect(junit.detectProjectCode('TEST002')).toBe('TEST')
		})
	})

	describe('no match', () => {
		test('returns null for unrecognized names', () => {
			expect(junit.detectProjectCode('some random test')).toBeNull()
			expect(junit.detectProjectCode('test_cart_items')).toBeNull()
		})
	})
})

describe('extractSeq', () => {
	describe('hyphenated markers (all formats)', () => {
		test('at start of name', () => {
			expect(junit.extractSeq('TEST-002 Cart items', 'TEST')).toBe(2)
			expect(playwright.extractSeq('TEST-002 Cart items', 'TEST')).toBe(2)
		})

		test('at end of name', () => {
			expect(junit.extractSeq('Cart items TEST-1234', 'TEST')).toBe(1234)
		})

		test('in middle of name', () => {
			expect(junit.extractSeq('Some TEST-042 thing', 'TEST')).toBe(42)
		})
	})

	describe('separator-bounded hyphenless (JUnit only)', () => {
		test('underscore-separated', () => {
			expect(junit.extractSeq('test_test002_cart', 'TEST')).toBe(2)
		})

		test('returns null for Playwright', () => {
			expect(playwright.extractSeq('test_test002_cart', 'TEST')).toBeNull()
		})

		test('requires name starting with "test"', () => {
			expect(junit.extractSeq('check_test002_cart', 'TEST')).toBeNull()
		})

		test('case-insensitive project code match', () => {
			expect(junit.extractSeq('test_bd026_cart', 'BD')).toBe(26)
		})
	})

	describe('camelCase start (JUnit only)', () => {
		test('marker after Test prefix', () => {
			expect(junit.extractSeq('TestTest002CartItems', 'TEST')).toBe(2)
		})

		test('returns null for Playwright', () => {
			expect(playwright.extractSeq('TestTest002CartItems', 'TEST')).toBeNull()
		})

		test('case-insensitive project code', () => {
			expect(junit.extractSeq('TestBd026Something', 'BD')).toBe(26)
		})
	})

	describe('camelCase end (JUnit only)', () => {
		test('marker at end of name', () => {
			expect(junit.extractSeq('TestCartItemsTest002', 'TEST')).toBe(2)
		})

		test('returns null for Playwright', () => {
			expect(playwright.extractSeq('TestCartItemsTest002', 'TEST')).toBeNull()
		})
	})

	describe('no match', () => {
		test('returns null for wrong project code', () => {
			expect(junit.extractSeq('TEST-002 Cart items', 'OTHER')).toBeNull()
		})

		test('returns null for no marker', () => {
			expect(junit.extractSeq('test_cart_items', 'TEST')).toBeNull()
		})
	})
})

describe('nameMatchesTCase', () => {
	describe('hyphenated markers (all formats)', () => {
		test('case-insensitive match', () => {
			expect(junit.nameMatchesTCase('test-002 Cart', 'TEST', 2)).toBe(true)
			expect(junit.nameMatchesTCase('TEST-002 Cart', 'TEST', 2)).toBe(true)
			expect(playwright.nameMatchesTCase('TEST-002 Cart', 'TEST', 2)).toBe(true)
		})

		test('marker anywhere in name', () => {
			expect(junit.nameMatchesTCase('Cart TEST-002 items', 'TEST', 2)).toBe(true)
			expect(junit.nameMatchesTCase('Cart items TEST-002', 'TEST', 2)).toBe(true)
		})

		test('no match for wrong seq', () => {
			expect(junit.nameMatchesTCase('TEST-002 Cart', 'TEST', 3)).toBe(false)
		})
	})

	describe('separator-bounded hyphenless (JUnit only)', () => {
		test('underscore-separated', () => {
			expect(junit.nameMatchesTCase('test_test002_cart', 'TEST', 2)).toBe(true)
		})

		test('returns false for Playwright', () => {
			expect(playwright.nameMatchesTCase('test_test002_cart', 'TEST', 2)).toBe(false)
		})

		test('requires name starting with "test"', () => {
			expect(junit.nameMatchesTCase('check_test002_cart', 'TEST', 2)).toBe(false)
		})

		test('no match for wrong seq', () => {
			expect(junit.nameMatchesTCase('test_test002_cart', 'TEST', 3)).toBe(false)
		})
	})

	describe('camelCase start (JUnit only)', () => {
		test('matches marker after Test prefix', () => {
			expect(junit.nameMatchesTCase('TestTest002CartItems', 'TEST', 2)).toBe(true)
		})

		test('returns false for Playwright', () => {
			expect(playwright.nameMatchesTCase('TestTest002CartItems', 'TEST', 2)).toBe(false)
		})

		test('no match for wrong seq', () => {
			expect(junit.nameMatchesTCase('TestTest002CartItems', 'TEST', 3)).toBe(false)
		})
	})

	describe('camelCase end (JUnit only)', () => {
		test('matches marker at end', () => {
			expect(junit.nameMatchesTCase('TestCartItemsTest002', 'TEST', 2)).toBe(true)
		})

		test('returns false for Playwright', () => {
			expect(playwright.nameMatchesTCase('TestCartItemsTest002', 'TEST', 2)).toBe(false)
		})

		test('no match for wrong seq', () => {
			expect(junit.nameMatchesTCase('TestCartItemsTest002', 'TEST', 3)).toBe(false)
		})
	})
})
