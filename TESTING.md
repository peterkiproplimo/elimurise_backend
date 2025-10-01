# Testing Documentation

This document provides information about the testing setup for the Elimurise backend.

## Test Framework

We are using Jest as our testing framework for unit and integration tests.

## Running Tests

To run all tests:

```bash
npm test
```

To run tests in watch mode:

```bash
npm run test:watch
```

To run tests with coverage:

```bash
npm run test:coverage
```

To run a specific test file:

```bash
npm test -- tests/filename.test.js
```

## Test Structure

Tests are organized in the following structure:

```
tests/
├── controllers/          # Controller tests
├── models/               # Model tests
├── services/             # Service tests
└── integration/          # Integration tests
```

## Test Coverage

Currently, we have implemented tests for:

1. Fee Category Controller
2. Fee Management Service
3. Invoice Controller
4. Payment Controller

## Dummy Data Seeding

To populate the database with dummy data for testing:

```bash
node utils/dummyDataSeeder.js
```

This script will:
1. Connect to the MongoDB database
2. Clear existing data
3. Generate dummy schools, users, fee categories, parents, learners, and fee structures

## Writing Tests

When writing new tests, follow these guidelines:

1. Use descriptive test names
2. Test both success and error cases
3. Mock external dependencies
4. Use beforeEach/afterEach for setup and teardown
5. Keep tests isolated and independent

## Continuous Integration

Tests are run automatically in the CI pipeline to ensure code quality and prevent regressions.