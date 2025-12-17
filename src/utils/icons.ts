
// A collection of SVG paths for system architecture diagrams
// Designed to look good on a 24x24 viewBox

export interface ArchitectureIcon {
    id: string;
    label: string;
    path: string;
    defaultColor: string;
    category: 'compute' | 'database' | 'storage' | 'network' | 'analytics';
}

export const ARCHITECTURE_ICONS: ArchitectureIcon[] = [
    {
        id: 'server',
        label: 'Server',
        path: 'M2 14h20M2 10h20M2 6h20M2 18h20M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z M6 8h.01 M6 12h.01 M6 16h.01',
        defaultColor: '#f97316', // Orange
        category: 'compute'
    },
    {
        id: 'lambda',
        label: 'Function',
        path: 'M12 2L2 22h20L12 2zm0 4l6 13H6l6-13z M9 18l3-6 3 6H9z', // Simplified Lambda/Triangle shape
        defaultColor: '#f97316',
        category: 'compute'
    },
    {
        id: 'database',
        label: 'Database',
        path: 'M4 6c0 1.7 3.6 3 8 3s8-1.3 8-3-3.6-3-8-3-8 1.3-8 3zm0 0v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
        defaultColor: '#3b82f6', // Blue
        category: 'database'
    },
    {
        id: 'storage',
        label: 'Storage',
        path: 'M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6zm3 3v.01M6 12v.01M6 15v.01M10 9h8M10 12h8M10 15h8',
        defaultColor: '#16a34a', // Green
        category: 'storage'
    },
    {
        id: 'bucket',
        label: 'S3 Bucket',
        path: 'M3 8l2-5h14l2 5M3 8v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8M3 8h18',
        defaultColor: '#16a34a', // Green
        category: 'storage'
    },
    {
        id: 'queue',
        label: 'Queue',
        path: 'M4 6h16M4 12h16M4 18h16M8 6v12M16 6v12', // Abstract visual of items in queue
        defaultColor: '#ec4899', // Pink
        category: 'network'
    },
    {
        id: 'analytics',
        label: 'Analytics',
        path: 'M3 21l6-6 4 4 8-10M3 21v-8M21 21v-8M21 9v12M3 21h18',
        defaultColor: '#8b5cf6', // Violet
        category: 'analytics'
    },
    {
        id: 'firewall',
        label: 'Firewall',
        path: 'M12 2l-9 4v6c0 5.5 5 10 9 10s9-4.5 9-10V6l-9-4zm0 18c-3.3 0-6-3.7-6-8V7l6-2.7L18 7v5c0 4.3-2.7 8-6 8z',
        defaultColor: '#ef4444', // Red
        category: 'network'
    },
    {
        id: 'user',
        label: 'User',
        path: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
        defaultColor: '#6b7280', // Gray
        category: 'network'
    },
    {
        id: 'docker',
        label: 'Container',
        path: 'M4 9h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9zm0-5h5v3H4V4zm6 0h5v3h-5V4zm6 0h4v3h-4V4z',
        defaultColor: '#0ea5e9', // Sky
        category: 'compute'
    },
    {
        id: 'globe',
        label: 'Internet',
        path: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
        defaultColor: '#6366f1',
        category: 'network'
    }
];
