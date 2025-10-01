# Learning Areas Migration

## make_initial_learning_areas_compulsory.js

This migration turns all initial learning areas to compulsory.

### What it does:

1. **Analyzes current state**: Shows statistics of existing learning areas
2. **Updates undefined fields**: Sets `is_compulsory: true` for learning areas that don't have this field
3. **Updates non-compulsory**: Converts all non-compulsory learning areas to compulsory
4. **Provides detailed logging**: Shows before/after statistics and sample data

### How to run:

```bash
# Option 1: Run the migration directly
node migrations/make_initial_learning_areas_compulsory.js

# Option 2: Use the helper script
node run_migration.js
```

### Expected output:

```
Starting migration: Making initial learning areas compulsory...

Current state:
Total learning areas: 25
Already compulsory: 5
Non-compulsory: 15
Undefined is_compulsory: 5

Updated 5 learning areas with undefined is_compulsory to compulsory.
Updated 15 non-compulsory learning areas to compulsory.

Final state:
Total compulsory learning areas: 25
Total non-compulsory learning areas: 0

Sample compulsory learning areas:
- Mathematics (Math) - Grade: GRADE 1
- English (Eng) - Grade: GRADE 1
- Science (Sci) - Grade: GRADE 2
...

Migration completed successfully!
```

### Notes:

- This migration makes ALL existing learning areas compulsory
- After this migration, all learning areas will be available to all schools by default
- Schools can still add optional learning areas through the assignment system
- This ensures consistency across all schools for core subjects 