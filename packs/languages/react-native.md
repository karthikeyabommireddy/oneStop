# Pack: React Native / Expo

**Runner** jest with @testing-library/react-native.
**E2E** Detox by default; Appium when device-cloud execution is required.

## Review focus

Load the `react` and `typescript` packs alongside this one - all their rules apply.

**Platform differences.** Anything using `Platform.OS` needs both branches verified.
Styling, keyboard behavior, safe areas, back navigation and permissions all differ.
Android hardware back must be handled explicitly.

**Lists.** `FlatList` or `FlashList` for anything unbounded - a `map` inside a
`ScrollView` renders every row and will not survive real data. Provide `keyExtractor`
and stable keys. `getItemLayout` where row height is fixed.

**Bridge cost.** Frequent small crossings are expensive. Animations driven from JS
stutter - use `useNativeDriver` or Reanimated so they run on the UI thread.

**Images.** Unsized remote images cause layout jumps. Large images without resizing
exhaust memory on low-end Android devices.

**Permissions.** Request at the moment of need with an explanation, and handle denial
and permanent denial as real paths - not as an error state nobody designed.

**Storage.** `AsyncStorage` is unencrypted - credentials and tokens belong in the
keychain or keystore.

**Network.** Offline is a normal state, not an exception. Every fetch needs a timeout,
a retry policy, and a visible failure state.

**Accessibility.** `accessibilityLabel` and `accessibilityRole` on every interactive
element; test at the largest font scale.
