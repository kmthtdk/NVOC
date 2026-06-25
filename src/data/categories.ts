import { CategorySpec, Ticket } from '../types';

export const IT_CATEGORIES: CategorySpec[] = [
  {
    id: 'general_request',
    name: 'General Request',
    icon: 'Laptop',
    description: 'General support requests, troubleshooting, or office specific workspace requests / VOC.',
    subcategories: [
      {
        id: 'troubleshooting',
        name: 'Troubleshooting',
        description: 'Resolve workspace bugs, Knox errors, and platform integrations.',
        types: [
          { id: 'office', name: 'Office', period: 'Non Apply' },
          { id: 'window', name: 'Window', period: 'Non Apply' },
          { id: 'knox', name: 'Knox', period: 'Non Apply' },
          { id: 'other_trouble', name: 'Other', period: 'Non Apply' }
        ]
      },
      {
        id: 'night_shift',
        name: 'Night Shift',
        description: 'Submit requests for on-duty specialists after general business hours.',
        types: [
          { id: 'support_ns', name: 'Support NS', period: 'Non Apply' }
        ]
      }
    ]
  },
  {
    id: 'network_request',
    name: 'Network Request',
    icon: 'Wifi',
    description: 'Register LAN network connections, static address assignment, or unblock connections.',
    subcategories: [
      {
        id: 'network_registration',
        name: 'Network registration',
        description: 'Provide details for allocating secure corporate workspace IPs.',
        types: [
          { id: 'ip_office', name: 'IP Office', period: 'Non Apply' },
          { id: 'ip_line', name: 'IP Line', period: 'Non Apply' },
          { id: 'ip_wifi', name: 'IP WIFI', period: 'Non Apply' }
        ]
      },
      {
        id: 'ip_phone',
        name: 'IP Phone',
        description: 'Configure voice connection, IP phone routing, or international gateway permission.',
        types: [
          { id: 'c2d', name: 'C2D', period: 'Non Apply' },
          { id: 'international_call', name: 'International Call', period: 'Non Apply' }
        ]
      },
      {
        id: 'other_network',
        name: 'Other Network',
        description: 'Submit request for network-related troubleshooting or configuration.',
        types: [
          { id: 'unblock_ip', name: 'Unblock IP', period: 'Non Apply' }
        ]
      }
    ]
  },
  {
    id: 'network_security',
    name: 'Network Security',
    icon: 'Shield',
    description: 'Secure corporate networking access, boundary routing permissions, and firewall rule configurations.',
    subcategories: [
      {
        id: 'firewall',
        name: 'Firewall',
        description: 'Request port opening or IP flow configurations between physical or logical zones.',
        types: [
          { id: 'access_line', name: 'Access to Line Zone', period: 'Apply' },
          { id: 'access_office', name: 'Access to Office Zone', period: 'Apply' },
          { id: 'access_server', name: 'Access to Server Zone', period: 'Apply' },
          { id: 'access_ai', name: 'Access to AI Zone', period: 'Apply' },
          { id: 'firewall_external', name: 'Firewall for external network', period: 'Apply' }
        ]
      }
    ]
  },
  {
    id: 'server_request',
    name: 'Server Request',
    icon: 'Server',
    description: 'Shared file directories, folder expand requests, directory data restorations, or standard permissions.',
    subcategories: [
      {
        id: 'folder',
        name: 'Folder',
        description: 'Request folder structure additions, capability enhancements, or Veeam snapshots.',
        types: [
          { id: 'create_folder', name: 'Create New Folder', period: 'Non Apply' },
          { id: 'expand_capacity', name: 'Expand Capacity', period: 'Non Apply' },
          { id: 'restore_data', name: 'Restore Data', period: 'Non Apply' }
        ]
      },
      {
        id: 'permission',
        name: 'Permission',
        description: 'Request read, write, modify, or full management credentials to specified corporate folders.',
        types: [
          { id: 'modify_folder', name: 'Modify Folder', period: 'Non Apply' },
          { id: 'read_folder', name: 'Read Folder', period: 'Non Apply' },
          { id: 'write_folder', name: 'Write Folder', period: 'Non Apply' },
          { id: 'account_server', name: 'Account Server', period: 'Non Apply' }
        ]
      },
      {
        id: 'ai',
        name: 'AI',
        description: 'Register corporate subscriptions for LLMs or secure workspace endpoints (API keys).',
        types: [
          { id: 'gemini', name: 'Gemini', period: 'Non Apply' },
          { id: 'gpt', name: 'GPT', period: 'Non Apply' },
          { id: 'api_access', name: 'API', period: 'Non Apply' }
        ]
      }
    ]
  },
  {
    id: 'security_request',
    name: 'Security Request',
    icon: 'Lock',
    description: 'Special authorization for network control exemptions, USB access, and data decryption operations.',
    subcategories: [
      {
        id: 'e',
        name: 'E',
        description: 'Special endpoint and hardware restriction bypass requests.',
        types: [
          { id: 'network_sharing', name: 'Network sharing Control', period: 'Apply' },
          { id: 'usb_rw', name: 'USB Read/ Write', period: 'Apply' }
        ]
      },
      {
        id: 'n',
        name: 'N',
        description: 'Secured document workflows, document mergers, or decryptions.',
        types: [
          { id: 'auto_decrypt', name: 'Automatic Decryption', period: 'Apply' },
          { id: 'compare_merge', name: 'Comparison/Merge', period: 'Apply' },
          { id: 'enforce_decrypt', name: 'Enforce Decryption', period: 'Apply' },
          { id: 'manual_decrypt', name: 'Manual Decryption', period: 'Apply' }
        ]
      },
      {
        id: 'pc_security',
        name: 'PC Security',
        description: 'Device security software exceptions, control exemptions, and execution policies.',
        types: [
          { id: 'no_security_app', name: 'No Security Application', period: 'Apply' },
          { id: 'mds_execution', name: 'MDS Excution', period: 'Apply' }
        ]
      }
    ]
  },
  {
    id: 'hardware_request',
    name: 'Hardware Request',
    icon: 'Monitor',
    description: 'Request new, repair, upgrade, return, or replacement of physical devices.',
    subcategories: [
      {
        id: 'desktop',
        name: 'Desktop',
        description: 'Corporate desktop configurations.',
        types: [
          { id: 'desktop_new', name: 'New', period: 'Non Apply' },
          { id: 'desktop_repair', name: 'Repair', period: 'Non Apply' },
          { id: 'desktop_replacement', name: 'Replacement', period: 'Non Apply' },
          { id: 'desktop_return', name: 'Return', period: 'Non Apply' }
        ]
      },
      {
        id: 'laptop',
        name: 'Laptop',
        description: 'Deploy or troubleshoot high-availability mobile workstations.',
        types: [
          { id: 'laptop_new', name: 'New', period: 'Non Apply' },
          { id: 'laptop_repair', name: 'Repair', period: 'Non Apply' },
          { id: 'laptop_replacement', name: 'Replacement', period: 'Non Apply' },
          { id: 'laptop_return', name: 'Return', period: 'Non Apply' }
        ]
      },
      {
        id: 'monitor',
        name: 'Monitor',
        description: 'External graphics output screens or displays.',
        types: [
          { id: 'monitor_new', name: 'New', period: 'Non Apply' },
          { id: 'monitor_repair', name: 'Repair', period: 'Non Apply' },
          { id: 'monitor_replacement', name: 'Replacement', period: 'Non Apply' },
          { id: 'monitor_return', name: 'Return', period: 'Non Apply' }
        ]
      },
      {
        id: 'phone',
        name: 'Phone',
        description: 'Corporate active smartphones or communication lines.',
        types: [
          { id: 'phone_new', name: 'New', period: 'Non Apply' },
          { id: 'phone_repair', name: 'Repair', period: 'Non Apply' },
          { id: 'phone_replacement', name: 'Replacement', period: 'Non Apply' },
          { id: 'phone_return', name: 'Return', period: 'Non Apply' }
        ]
      },
      {
        id: 'tablet',
        name: 'Tablet',
        description: 'Active design tablets or mobile utility boards.',
        types: [
          { id: 'tablet_new', name: 'New', period: 'Non Apply' },
          { id: 'tablet_repair', name: 'Repair', period: 'Non Apply' },
          { id: 'tablet_replacement', name: 'Replacement', period: 'Non Apply' },
          { id: 'tablet_return', name: 'Return', period: 'Non Apply' }
        ]
      },
      {
        id: 'deskphone',
        name: 'Deskphone',
        description: 'Fixed corporate workspace voice terminals.',
        types: [
          { id: 'deskphone_new', name: 'New', period: 'Non Apply' },
          { id: 'deskphone_repair', name: 'Repair', period: 'Non Apply' },
          { id: 'deskphone_replacement', name: 'Replacement', period: 'Non Apply' },
          { id: 'deskphone_return', name: 'Return', period: 'Non Apply' }
        ]
      },
      {
        id: 'removable_disk',
        name: 'Removable Disk',
        description: 'External solid state storage drives or secure keys.',
        types: [
          { id: 'removable_new', name: 'New', period: 'Non Apply' },
          { id: 'removable_replacement', name: 'Replacement', period: 'Non Apply' },
          { id: 'removable_return', name: 'Return', period: 'Non Apply' }
        ]
      },
      {
        id: 'accessories',
        name: 'Accessories',
        description: 'Keyboard, Mouse, Headset, Docking station, or other peripherals.',
        types: [
          { id: 'accessories_new', name: 'New', period: 'Non Apply' },
          { id: 'accessories_repair', name: 'Repair', period: 'Non Apply' },
          { id: 'accessories_replacement', name: 'Replacement', period: 'Non Apply' },
          { id: 'accessories_return', name: 'Return', period: 'Non Apply' }
        ]
      }
    ]
  }
];

export const INITIAL_TICKETS: Ticket[] = [
  {
    id: '1',
    code: 'REQ-2026-0001',
    title: 'Request Firewall permission access to server zone database',
    requesterName: 'Alex Mercer',
    requesterEmail: 'alex.mercer@company.com',
    requesterDept: 'R&D / Software Engineering',
    category: 'network_security',
    subcategory: 'firewall',
    priority: 'high',
    description: 'Need access to the server database zone database environment to support a critical hotfix deployment this weekend. I confirm adherence to corporate security protocols.',
    status: 'resolved',
    createdAt: '2026-06-16T09:30:00-07:00',
    updatedAt: '2026-06-16T15:45:00-07:00',
    assignedTo: 'Marcus Vance (Network Architect)',
    comments: [
      {
        id: 'c1',
        author: 'Alex Mercer',
        role: 'requester',
        content: 'Hi IT support! Please review and approve this as soon as possible so we can hit our evening staging target.',
        createdAt: '2026-06-16T10:00:00-07:00'
      },
      {
        id: 'c2',
        author: 'Marcus Vance',
        role: 'it_support',
        content: 'Your network security rule has been successfully deployed. Let us know if checking connection holds alright.',
        createdAt: '2026-06-16T15:30:00-07:00'
      },
      {
        id: 'c3',
        author: 'Alex Mercer',
        role: 'requester',
        content: 'Successfully authenticated. Connecting fine. Thank you so much!',
        createdAt: '2026-06-16T15:45:00-07:00'
      }
    ],
    history: [
      {
        id: 'h1',
        status: 'submitted',
        statusLabel: 'VOC Submitted',
        updatedBy: 'Alex Mercer',
        notes: 'Awaiting IT triage.',
        createdAt: '2026-06-16T09:30:00-07:00'
      },
      {
        id: 'h2',
        status: 'waiting',
        statusLabel: 'Under Investigation',
        updatedBy: 'Marcus Vance',
        notes: 'Triage complete. Configuring policy rules on Fortigate firewall and provisioning database credentials.',
        createdAt: '2026-06-16T11:15:00-07:00'
      },
      {
        id: 'h3',
        status: 'resolved',
        statusLabel: 'Issue Resolved',
        updatedBy: 'Marcus Vance',
        notes: 'Access granted. Policy finalized and tested successfully.',
        createdAt: '2026-06-16T15:30:00-07:00'
      }
    ],
    details: {
      sourceIp: '10.20.15.5',
      destinationIp: '192.168.100.12',
      protocolPort: 'TCP-5432'
    }
  },
  {
    id: '2',
    code: 'REQ-2026-0002',
    title: 'Restore accidentally deleted project directory "Campaign_Q2"',
    requesterName: 'Sarah Connor',
    requesterEmail: 'sarah.c@company.com',
    requesterDept: 'Marketing & PR Dept',
    category: 'server_request',
    subcategory: 'folder',
    priority: 'urgent',
    description: 'Someone from the design workflow deleted the folder Campaign_Q2 on the shared drive (S:\\Marketing\\Active_Projects\\). It contains high-resolution assets and media plan templates for Q3 rollout.',
    status: 'waiting',
    createdAt: '2026-06-17T08:00:00-07:00',
    updatedAt: '2026-06-17T14:10:00-07:00',
    assignedTo: 'Lucas Croft (System Administrator)',
    comments: [
      {
        id: 'c4',
        author: 'Lucas Croft',
        role: 'it_support',
        content: 'I am tracking down the latest nightly backup on our Veeam Backup catalog. The last automated backup of the share completed at 23:00 yesterday. I am mounting that copy now.',
        createdAt: '2026-06-17T11:00:00-07:00'
      },
      {
        id: 'c5',
        author: 'Sarah Connor',
        role: 'requester',
        content: 'That works beautifully! We only edited a few spreadsheets this morning, we can recreate those. Restoring to yesterdays state will prevent massive delays! Thank you.',
        createdAt: '2026-06-17T11:20:00-07:00'
      }
    ],
    history: [
      {
        id: 'h4',
        status: 'submitted',
        statusLabel: 'VOC Submitted',
        updatedBy: 'Sarah Connor',
        notes: 'Awaiting SLA prioritisation.',
        createdAt: '2026-06-17T08:00:00-07:00'
      },
      {
        id: 'h5',
        status: 'waiting',
        statusLabel: 'System Diagnostics',
        updatedBy: 'Lucas Croft',
        notes: 'Identified the directory mount structure. Initialising folder snapshot restore process.',
        createdAt: '2026-06-17T10:45:00-07:00'
      }
    ],
    details: {
      serverAction: 'folder',
      folderActionType: 'restore',
      folderPath: 'S:\\Marketing\\Active_Projects\\Campaign_Q2'
    }
  },
  {
    id: '3',
    code: 'REQ-2026-0003',
    title: 'Provision Write access to S:\\Finance\\Reports_2026 for Emily Thorne',
    requesterName: 'Jonathan Davis',
    requesterEmail: 'jona.davis@company.com',
    requesterDept: 'Finance & Accounts',
    category: 'server_request',
    subcategory: 'permission',
    priority: 'medium',
    description: 'We need to provision granular write/change access control permissions for our new accountant Emily Thorne (emily.t@company.com) so she can publish recent audit reports.',
    status: 'submitted',
    createdAt: '2026-06-17T15:20:00-07:00',
    updatedAt: '2026-06-17T15:20:00-07:00',
    assignedTo: 'Unassigned',
    comments: [],
    history: [
      {
        id: 'h6',
        status: 'submitted',
        statusLabel: 'VOC Raised',
        updatedBy: 'Jonathan Davis',
        notes: 'The system has successfully logged the access request. Awaiting administrator approval.',
        createdAt: '2026-06-17T15:20:00-07:00'
      }
    ],
    details: {
      serverAction: 'permission',
      targetUser: 'Emily Thorne (emily.t@company.com)',
      folderPath: 'S:\\Finance\\Reports_2026',
      permissionActionType: ['read', 'write', 'modify']
    }
  },
  {
    id: '4',
    code: 'REQ-2026-0004',
    title: 'Laptop producing abnormal noise and thermal shutting down',
    requesterName: 'Chloe Frazer',
    requesterEmail: 'chloe.f@company.com',
    requesterDept: 'Creative Art & Animation Suite',
    category: 'hardware_request',
    subcategory: 'laptop',
    priority: 'high',
    description: 'My primary workstation laptop emits a high-pitched whistling noise when starting high-load processes. It has shut down abruptly three times while rendering Photoshop artboards this morning due to extreme heat.',
    status: 'waiting',
    createdAt: '2026-06-15T11:00:00-07:00',
    updatedAt: '2026-06-16T10:10:00-07:00',
    assignedTo: 'Nicholas Croft (Hardware Support)',
    comments: [
      {
        id: 'c6',
        author: 'Nicholas Croft',
        role: 'it_support',
        content: 'This feels like a mechanical blockage in the cooler fan or dried CPU thermal compound. Please hand over the computer at the IT Desk (Room 402, 4th floor) during business hours.',
        createdAt: '2026-06-15T14:30:00-07:00'
      },
      {
        id: 'c7',
        author: 'Nicholas Croft',
        role: 'it_support',
        content: 'Kindly reminder: We still await your laptop handoff at the desk. Let us resolve this before any permanent silicon hardware degradation occurred. Thanks!',
        createdAt: '2026-06-16T10:10:00-07:00'
      }
    ],
    history: [
      {
        id: 'h7',
        status: 'submitted',
        statusLabel: 'VOC Logs Received',
        updatedBy: 'Chloe Frazer',
        notes: 'Awaiting physical hardware diagnosis.',
        createdAt: '2026-06-15T11:00:00-07:00'
      },
      {
        id: 'h8',
        status: 'waiting',
        statusLabel: 'Assigned & Accepted',
        updatedBy: 'Nicholas Croft',
        notes: 'Identified hardware thermal throttling error. Requested direct handoff for physical dusting and re-pasting.',
        createdAt: '2026-06-15T14:30:00-07:00'
      },
      {
        id: 'h9',
        status: 'waiting',
        statusLabel: 'Awaiting Device Handoff',
        updatedBy: 'Nicholas Croft',
        notes: 'Pending customer physical delivery to IT suite.',
        createdAt: '2026-06-16T10:10:00-07:00'
      }
    ],
    details: {
      deviceActionType: 'repair',
      deviceType: 'Laptop',
      deviceModelName: 'Dell XPS 9310'
    }
  },
  {
    id: '5',
    code: 'REQ-2026-0005',
    title: 'PC Security exemption for local driver development compilation',
    requesterName: 'Khoa Tran',
    requesterEmail: 'khoatpv@gmail.com',
    requesterDept: 'R&D / Software Engineering',
    category: 'security_request',
    subcategory: 'pc_security',
    priority: 'medium',
    description: 'Require temporary No Security Application exclusion on my engineering machine. Need to bypass the automated sandboxing engine to compile, build, and local-test customized native software drivers.',
    status: 'submitted',
    createdAt: '2026-06-18T09:12:00-07:00',
    updatedAt: '2026-06-18T09:12:00-07:00',
    assignedTo: 'Unassigned',
    comments: [],
    history: [
      {
        id: 'h10',
        status: 'submitted',
        statusLabel: 'Exemption Requested',
        updatedBy: 'Khoa Tran',
        notes: 'Exemption policy initialized in system queue. Target software policy will apply on approval matching.',
        createdAt: '2026-06-18T09:12:00-07:00'
      }
    ],
    details: {
      pcSecurityHost: 'PC-KHOATPV-DEV1',
      pcSecurityReason: 'Building customized native binaries for low-level platform interfaces.'
    }
  }
];
