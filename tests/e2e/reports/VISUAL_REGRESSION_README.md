# Visual Regression Testing Suite

## Overview

Comprehensive screenshot collection system for GraphDone UI monitoring and visual regression testing. This suite captures screenshots across 21 different device configurations and 10+ core application screens, generating 250-300 total screenshots per test run.

## Purpose

- **Visual Regression Testing**: Compare UI changes across releases
- **DevOps Monitoring**: Automated visual change detection in CI/CD pipeline
- **Cross-Device Compatibility**: Verify UI renders correctly on all devices
- **UI/UX Documentation**: Maintain visual records of application state
- **Design Review**: Provide stakeholders with visual references

## Device Coverage

### Mobile Phones (Portrait)
- iPhone SE (375×667, 2x)
- iPhone 12/13/14 (390×844, 3x)
- iPhone 14 Pro Max (430×932, 3x)
- Samsung Galaxy S21 (360×800, 3x)
- Google Pixel 7 (412×915, 2.625x)

### Mobile Phones (Landscape)
- iPhone 14 Landscape (844×390, 3x)
- Samsung Galaxy Landscape (800×360, 3x)

### Tablets (Portrait)
- iPad Mini (768×1024, 2x)
- iPad Air (820×1180, 2x)
- iPad Pro 11" (834×1194, 2x)
- iPad Pro 12.9" (1024×1366, 2x)
- Samsung Galaxy Tab (800×1280, 2x)

### Tablets (Landscape)
- iPad Pro 11" Landscape (1194×834, 2x)
- iPad Pro 12.9" Landscape (1366×1024, 2x)

### Desktop
- HD (1366×768, 1x)
- Full HD (1920×1080, 1x)
- QHD (2560×1440, 1x)
- 4K (3840×2160, 1x)

### Ultrawide
- QHD Ultrawide (3440×1440, 1x)
- 4K Ultrawide (5120×2160, 1x)

## Screens Captured

- **Landing Page** (`/`)
- **Login** (`/login`)
- **Workspace** (`/workspace`)
- **Graph View** (`/graph`) - Core visualization
- **Projects** (`/projects`)
- **Settings** (`/settings`)
- **Profile** (`/profile`)
- **Admin Panel** (`/admin`)
- **Admin Users** (`/admin/users`)
- **Admin System** (`/admin/system`)

Plus interactive states:
- Button hover states (up to 5 buttons)
- Modal/dialog states (up to 3 modals)

## Running the Suite

### Standalone Execution
```bash
npm run test:e2e:visual
```

### As Part of Full E2E Test Suite
```bash
npm run test:e2e
# Or in VM:
./tools/test-vm-e2e.sh
```

### Disable Visual Regression in E2E Suite
```bash
RUN_VISUAL_REGRESSION=false ./tools/test-vm-e2e.sh
```

## Output Structure

```
test-artifacts/visual-regression/{timestamp}/
├── iPhone-SE/
│   ├── landing-page.png
│   ├── login.png
│   ├── workspace.png
│   └── ...
├── iPad-Pro-11/
│   ├── landing-page.png
│   └── ...
├── Desktop-Full-HD/
│   ├── landing-page.png
│   └── ...
├── SUMMARY.md
└── ...
```

Each test run creates a timestamped directory with:
- Device-specific subdirectories
- PNG screenshots for each screen
- `SUMMARY.md` with test metadata and configuration

## Integration with GraphDone-DevOps

The visual regression suite is designed to provide comprehensive data for the GraphDone-DevOps repository to consume and analyze. It does NOT include a complex results viewer - that responsibility belongs to GraphDone-DevOps.

### Expected DevOps Integration:

1. **Automated Comparison**: Use tools like Pixelmatch or Percy for visual diff analysis
2. **Artifact Storage**: Upload screenshots to S3/artifact storage for historical tracking
3. **CI/CD Alerts**: Trigger notifications when visual changes exceed thresholds
4. **Baseline Management**: Store approved screenshots as baselines for comparison
5. **Reporting Dashboard**: Build viewing and organization tools in GraphDone-DevOps

### Data Format

Screenshots are organized by:
- **Timestamp**: ISO format (YYYY-MM-DDTHH-mm-ss)
- **Device**: Descriptive name (e.g., "iPhone-14-Pro-Max", "Desktop-Full-HD")
- **Screen**: Sanitized route name (e.g., "landing-page", "admin-users")

All filenames are consistent and parseable for automated processing.

## Configuration

### Adjusting Device List

Edit `tests/e2e/visual-regression-suite.spec.ts`:

```typescript
const DEVICES = [
  { name: 'Custom-Device', width: 1024, height: 768, deviceScaleFactor: 1 },
  // ... add more devices
];
```

### Adjusting Screens

Edit the `SCREENS` array:

```typescript
const SCREENS = [
  { route: '/custom-route', name: 'custom-screen' },
  // ... add more screens
];
```

### Adjusting Timeouts

- **Page Load**: Line 141 - `timeout: 30000` (30 seconds)
- **Content Wait**: Line 148 - `waitForTimeout(2000)` (2 seconds)
- **Screenshot Retry**: Line 81 - `maxRetries = 3`

## Performance Considerations

### Test Duration
- ~5-10 seconds per device configuration
- Total runtime: ~3-5 minutes for all 21 devices

### Disk Usage
- ~50-200KB per screenshot (depends on content)
- ~250-300 screenshots per run
- Total: ~15-60MB per test run

### Resource Requirements
- Memory: ~2GB RAM for Playwright + browsers
- CPU: Moderate (screenshot capture is CPU-intensive)
- Disk I/O: Moderate (writing many PNG files)

## Best Practices

1. **Run on Stable State**: Execute after UI changes are complete
2. **Consistent Environment**: Use same browser versions for comparisons
3. **Network Independence**: Tests should not depend on external services
4. **Baseline Updates**: Update baselines when intentional UI changes occur
5. **Artifact Cleanup**: Regularly archive or delete old screenshot sets

## Troubleshooting

### Screenshots Failing
- Check if application is running (`npm run dev`)
- Verify routes exist in the application
- Increase timeouts if content loads slowly

### Missing Browsers
- Run `npx playwright install --with-deps`
- Verify in VM: `ls -la ~/.cache/ms-playwright/`

### Incomplete Screenshot Sets
- Check disk space
- Review Playwright logs for specific errors
- Verify network connectivity to localhost:3127

## Future Enhancements

- [ ] Add visual diff comparison tool integration
- [ ] Implement baseline screenshot management
- [ ] Add screenshot annotations (highlights, labels)
- [ ] Support for authenticated routes
- [ ] Dark mode screenshot variants
- [ ] Accessibility contrast analysis
- [ ] Mobile gesture simulation capture
- [ ] Video recording for interactions

## Related Documentation

- E2E Test Suite: `tests/e2e/`
- Test VM Setup: `tools/test-vm-e2e.sh`
- Playwright Config: `playwright.config.ts`
- DevOps Integration: (See GraphDone-DevOps repository)
