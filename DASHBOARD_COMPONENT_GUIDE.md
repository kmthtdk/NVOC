# Dashboard Component Guide

## Overview

The enhanced `Dashboard.tsx` component provides a comprehensive admin dashboard for the N-VOC system with real-time request tracking, status visualization, and device inventory management. It displays key metrics, charts, recent activity, and device inventory status in a responsive, multi-row layout.

## Component Structure

### 1. Type Definitions

```typescript
interface DashboardStats {
  summary: {
    total: number;
    submitted: number;
    processing: number;
    pending_user: number;
    resolved: number;
    rejected: number;
    pending: number;
    resolutionRate: number;
  };
  categories: Record<string, number>;
  priorities: {
    low: number;
    medium: number;
    high: number;
    urgent: number;
  };
}

interface RecentStats {
  recent_submitted: Ticket[];
  recent_resolved: Ticket[];
  unassigned_pending: Ticket[];
}

interface Ticket {
  id: number;
  code: string;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
  assignedTo: string;
  category?: string;
}

interface DeviceInventoryStatus {
  total: number;
  available: number;
  assigned: number;
  maintenance: number;
  retired: number;
}
```

## Sub-Components

### SummaryCard
**Purpose:** Displays individual KPI metrics with icons and optional trend indicators

**Props:**
- `label: string` - Card title
- `value: number | string` - Main metric value
- `icon: React.ReactNode` - Icon component
- `bgColor: string` - Background color class
- `borderColor: string` - Border color class
- `trend?: { value: number; direction: 'up' | 'down' }` - Optional trend data

**Features:**
- Left border accent for visual emphasis
- Trend indicator with directional arrow
- Hover shadow effect for interactivity
- Responsive sizing

**Example Usage:**
```jsx
<SummaryCard
  label="Total Requests"
  value={stats.summary.total}
  icon={<AlertCircle className="w-6 h-6 text-blue-600" />}
  bgColor="bg-blue-100"
  borderColor="border-blue-500"
  trend={{ value: 12, direction: 'up' }}
/>
```

### SimpleBarChart
**Purpose:** CSS-based horizontal bar chart without external charting library dependency

**Props:**
- `data: ChartDataPoint[]` - Array of {name, value, fill?}
- `title: string` - Chart title
- `maxValue?: number` - Maximum value for scaling (auto-calculated if omitted)

**Features:**
- Responsive width calculation
- Hover effects
- Clean Tailwind styling
- Automatic scaling based on data range
- No recharts dependency (reduces bundle size)

**Data Format:**
```typescript
interface ChartDataPoint {
  name: string;
  value: number;
  fill?: string; // Tailwind bg color class
}
```

### SimplePieChart
**Purpose:** SVG-based donut chart with legend for status/priority distribution

**Props:**
- `data: ChartDataPoint[]` - Array of data points
- `title: string` - Chart title

**Features:**
- SVG rendering for crisp graphics
- Percentage calculations
- Color-coded legend
- Responsive layout (vertical on mobile, horizontal on desktop)
- No external charting library required

### DeviceStatusCard
**Purpose:** Displays device inventory metrics with progress bars

**Props:**
- `label: string` - Status label (Available, Assigned, etc.)
- `count: number` - Current count
- `total: number` - Total devices
- `icon: React.ReactNode` - Status icon
- `bgColor: string` - Icon background color
- `textColor: string` - Progress bar color

**Features:**
- Percentage calculation
- Visual progress indicator
- Color-coded by status
- Compact card layout

### ActivityTableRow
**Purpose:** Renders individual rows in the recent activity table

**Props:**
- `ticket: Ticket` - Ticket data
- `index: number` - Row index
- `isPriority?: boolean` - Highlight unassigned tickets

**Features:**
- Dynamic status badge styling
- Priority badge with color coding
- Date formatting
- Hover effects
- Optional red background for priority items

## State Management

### Main State Variables

```typescript
const [stats, setStats] = useState<DashboardStats | null>(null);
const [recent, setRecent] = useState<RecentStats | null>(null);
const [deviceStatus, setDeviceStatus] = useState<DeviceInventoryStatus | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
```

### Data Fetching

**Effect Hook:** Runs once on component mount
```typescript
useEffect(() => {
  const loadDashboard = async () => {
    // Parallel API requests for tickets stats, recent activity, and device status
    const [statsRes, recentRes, devicesRes] = await Promise.all([
      fetch('/api/tickets/stats/summary', { headers, credentials: 'include' }),
      fetch('/api/tickets/stats/recent', { headers, credentials: 'include' }),
      fetch('/api/devices/stats', { headers, credentials: 'include' }),
    ]);
    // Handle responses and error states
  };
  loadDashboard();
}, []);
```

**Key Features:**
- Parallel data fetching with `Promise.all()` for performance
- Auth token attached via headers
- Credentials included for session management
- Separate error handling per endpoint
- Graceful fallbacks when endpoints are unavailable

### Memoized Derived State

```typescript
const statusData = useMemo<ChartDataPoint[]>(() => [...], [stats]);
const priorityData = useMemo<ChartDataPoint[]>(() => [...], [stats]);
const categoryData = useMemo<ChartDataPoint[]>(() => [...], [stats]);
const recentActivity = useMemo<Ticket[]>(() => [...], [recent]);
const hasUnassignedPending = recent && recent.unassigned_pending.length > 0;
```

**Benefits:**
- Prevents unnecessary re-computation
- Filters and sorts data efficiently
- Limits chart data to top 8 categories
- Merges recent submissions and resolutions
- Optimal performance during re-renders

## Rendering Logic

### Layout Structure

The dashboard uses a 4-row responsive grid:

#### Row 1: Summary Cards (4 Columns)
```
Total Requests | Submitted | In Progress | Resolved
```
- Grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`
- Responsive: 1 col on mobile, 2 on tablet, 4 on desktop
- Key Metrics: Total, submitted count, processing count, resolution rate

#### Row 2: Status & Priority Charts (2 Columns)
```
Status Distribution (Bar) | Priority Breakdown (Donut Pie)
```
- Grid: `grid-cols-1 lg:grid-cols-2`
- Status: Submitted, Processing, Pending, Resolved, Rejected
- Priority: Low, Medium, High, Urgent
- Filtering: Only shows statuses/priorities with value > 0

#### Row 3: Categories + Activity Table (3 Columns)
```
Request Categories (Bar) | Recent Activity Table (5 rows)
```
- Grid: `grid-cols-1 lg:grid-cols-3`
- Categories: Bar chart of top 8 categories
- Activity: Merged submitted + resolved tickets, sorted by date
- Table: 6 columns (Ticket, Title, Status, Priority, Created, Assigned To)

#### Row 4: Device Inventory Status (5 Cards)
```
Total | Available | Assigned | Maintenance | Retired
```
- Grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-5`
- Shows percentage of each status
- Only rendered if device data is available

#### Alert Section: Unassigned Pending Requests
- Red gradient background
- Shows count and top 3 tickets
- Only rendered if unassigned tickets exist

### Conditional Rendering

```typescript
// Loading state
if (loading) return <LoadingSpinner />;

// Error state
if (error) return <ErrorAlert />;

// No data state
if (!stats) return <NoDataAlert />;

// Device inventory (conditional)
{deviceStatus && <DeviceInventorySection />}

// Unassigned alert (conditional)
{hasUnassignedPending && <UnassignedAlert />}
```

## API Endpoints

### Required Endpoints

1. **`GET /api/tickets/stats/summary`**
   - Response: `DashboardStats`
   - Provides: Total, status breakdown, category breakdown, priority breakdown

2. **`GET /api/tickets/stats/recent`**
   - Response: `RecentStats`
   - Provides: Recent submissions, recent resolutions, unassigned pending

3. **`GET /api/devices/stats`**
   - Response: `DeviceInventoryStatus`
   - Provides: Device inventory counts by status
   - Optional: Can return null if not implemented

## Styling

### Color Scheme

- **Blue:** Submitted, Low priority, Available devices
- **Amber/Yellow:** Processing, Medium priority
- **Purple:** Pending user response
- **Green:** Resolved, High availability
- **Orange/Red:** High/Urgent priority, Rejected, Maintenance/Retired
- **Gray:** Neutral, Retired devices

### Tailwind Classes Used

- Grid layouts: `grid`, `grid-cols-*`, `lg:grid-cols-*`
- Cards: `bg-white`, `rounded-lg`, `shadow-sm`, `p-6`
- Typography: `text-gray-900`, `font-semibold`, `text-lg`
- Spacing: `gap-4`, `gap-6`, `space-y-4`, `space-y-6`
- Interactive: `hover:shadow-md`, `transition-all`
- Status colors: Dynamic classes for badges

## Icons (Lucide React)

```typescript
// Summary cards
AlertCircle, Clock, TrendingUp, CheckCircle

// Chart headers
BarChart3, PieChart as PieChartIcon

// Device inventory
HardDrive, Wifi, Cpu, CheckCircle2, XCircle

// Alerts & navigation
Zap, AlertTriangle, ChevronRight, Activity
```

## Performance Optimizations

1. **Memoization:** `useMemo` prevents expensive recalculations
2. **Parallel Requests:** `Promise.all()` fetches data concurrently
3. **Lazy SVG Rendering:** Charts rendered only when data available
4. **Efficient Filtering:** Data filtered to show only non-zero values
5. **No External Chart Library:** Custom CSS-based charts reduce bundle size

## Usage

```typescript
import Dashboard from './components/Dashboard';

// In your App.tsx or admin section
<Dashboard />
```

## Recent Activity Calculation

The component merges recent submissions and resolutions:

```typescript
const recentActivity = useMemo<Ticket[]>(() => {
  if (!recent) return [];
  return [
    ...recent.recent_submitted.slice(0, 3),      // Last 3 submissions
    ...recent.recent_resolved.slice(0, 2),       // Last 2 resolutions
  ].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 5);                                   // Top 5 by date
}, [recent]);
```

This ensures a balanced view of both incoming and resolved requests.

## Error Handling

- **Network Errors:** Displayed as error alert
- **Missing Data:** Shown as "No Data Available"
- **Partial Data:** Dashboard renders available sections gracefully
- **Device Stats Optional:** Device row only renders if data exists
- **Unassigned Alert:** Only shows if there are unassigned tickets

## Future Enhancements

1. **Real-time Updates:** WebSocket integration for live data
2. **Date Range Filtering:** Filter stats by date range
3. **Export Functionality:** Export dashboard as PDF/CSV
4. **Drill-down Details:** Click cards to see filtered ticket lists
5. **Custom Dashboards:** User-configurable dashboard layouts
6. **Comparison Metrics:** Week-over-week, month-over-month trends
7. **Department Filtering:** Filter by department/requester
8. **SLA Tracking:** Display SLA compliance metrics

## Accessibility

- Semantic HTML (`<table>`, `<thead>`, `<tbody>`)
- Icon descriptions via ARIA labels
- Color not sole differentiator (status badges included)
- Keyboard navigable
- Screen reader compatible

## Browser Compatibility

- Modern browsers with SVG support
- CSS Grid support (fallback to single column)
- No IE11 support required
- Works on mobile, tablet, desktop

## Notes

- Dashboard stats endpoint should limit to 200 records for performance
- Device stats endpoint may return null if not available
- All times displayed in user's local timezone
- Authentication required (token-based)
- Responsive design optimized for screens 320px and above
