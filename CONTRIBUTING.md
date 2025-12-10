# Contributing

## Development Setup

1. Fork and clone the repo
2. Install dependencies: `pnpm install`
3. Copy `.env.example` files and configure
4. Run tests: `pnpm test`

## Code Style

- TypeScript strict mode
- Prettier for formatting
- ESLint for linting
- Run `pnpm format` before committing

## Commit Messages

Follow conventional commits:

```
feat: add new betting panel component
fix: resolve payout calculation bug
docs: update architecture diagram
test: add settle_round integration test
chore: update dependencies
```

## Pull Request Process

1. Create feature branch from `main`
2. Make changes with tests
3. Ensure CI passes
4. Request review
5. Squash and merge

## Testing

- Program: `anchor test` in program directory
- SDK/Apps: `pnpm test` from root
- All tests must pass before merge

## Questions?

Open a GitHub issue for discussion.
