import React, { useState, useEffect } from 'react';
import { IT_CATEGORIES } from '../data/categories';
import { Ticket, TicketPriority, CategorySpec } from '../types';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Spinner } from './ui/Spinner';
import {
  Send,
  Laptop,
  Wifi,
  Shield,
  Monitor,
  Lock,
  Cpu,
  Server,
  CheckCircle2,
  AlertCircle,
  FileText,
  Paperclip,
  Sparkles,
  X,
} from 'lucide-react';

interface RequestFormProps {
  // Called after a ticket is successfully persisted, so the parent can refresh.
  onCreated: (ticket: Ticket) => void;
  // Live taxonomy from the API; falls back to the bundled static list.
  categories?: CategorySpec[];
}

const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: 'low', label: 'Low — Routine' },
  { value: 'medium', label: 'Medium — Standard SLA' },
  { value: 'high', label: 'High — Expedited' },
  { value: 'urgent', label: 'Urgent — Critical / Outage' },
];

const MAX_FILES = 10;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // mirror a sensible client guard

// Icon mapping based on string
const getCategoryIcon = (iconName: string) => {
  switch (iconName) {
    case 'Laptop': return <Laptop className="w-5 h-5 text-violet-600" />;
    case 'Wifi': return <Wifi className="w-5 h-5 text-sky-600" />;
    case 'Shield': return <Shield className="w-5 h-5 text-emerald-600" />;
    case 'Monitor': return <Monitor className="w-5 h-5 text-amber-600" />;
    case 'Lock': return <Lock className="w-5 h-5 text-rose-600" />;
    case 'Cpu': return <Cpu className="w-5 h-5 text-purple-600" />;
    case 'Server': return <Server className="w-5 h-5 text-blue-600" />;
    default: return <FileText className="w-5 h-5 text-slate-600" />;
  }
};

const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function RequestForm({ onCreated, categories }: RequestFormProps) {
  const { user } = useAuth();
  const toast = useToast();

  // Live taxonomy if provided by the API, else the bundled static list.
  const taxonomy: CategorySpec[] = categories && categories.length > 0 ? categories : IT_CATEGORIES;

  // Main form states — prefill requester identity from the authenticated user.
  const [requesterName, setRequesterName] = useState(user?.fullName ?? '');
  const [requesterEmail, setRequesterEmail] = useState(user?.email ?? '');
  const [requesterDept, setRequesterDept] = useState(user?.department ?? 'Engineering & Infrastructure');

  const [selectedCategory, setSelectedCategory] = useState('general_request');
  const [selectedSubcategory, setSelectedSubcategory] = useState('troubleshooting');
  const [selectedType, setSelectedType] = useState('office');

  // Priority is now user-selectable (defaults to medium).
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Attachments staged client-side; uploaded after the ticket is created.
  const [files, setFiles] = useState<File[]>([]);
  // Submission + AI triage in-flight flags.
  const [submitting, setSubmitting] = useState(false);
  const [triaging, setTriaging] = useState(false);

  // Custom period states
  const [periodFrom, setPeriodFrom] = useState(getTodayString());
  const [periodTo, setPeriodTo] = useState('');
  const [duration, setDuration] = useState('1 Day');

  // Custom spec states
  const [osType, setOsType] = useState('Windows 11');
  const [softwareName, setSoftwareName] = useState('');
  
  const [ipAddress, setIpAddress] = useState('');
  const [macAddress, setMacAddress] = useState('');
  const [wifiUserName, setWifiUserName] = useState('');
  const [wifiDeviceType, setWifiDeviceType] = useState('Laptop');

  const [sourceIp, setSourceIp] = useState('');
  const [destinationIp, setDestinationIp] = useState('');
  const [protocolPort, setProtocolPort] = useState('');
  const [firewallAction, setFirewallAction] = useState<'allow' | 'deny'>('allow');

  const [deviceActionType, setDeviceActionType] = useState<'new' | 'replace' | 'repair' | 'return'>('new');
  const [deviceType, setDeviceType] = useState('Laptop');
  const [deviceModelName, setDeviceModelName] = useState('');
  const [reasonForChange, setReasonForChange] = useState('');

  const [usbDuration, setUsbDuration] = useState('1 Day');
  const [usbJustification, setUsbJustification] = useState('');
  const [decryptionFiles, setDecryptionFiles] = useState('');
  const [pcSecurityHost, setPcSecurityHost] = useState('');
  const [pcSecurityReason, setPcSecurityReason] = useState('');

  const [serviceName, setServiceName] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');

  const [serverAction, setServerAction] = useState<'folder' | 'permission' | 'ai'>('folder');
  const [folderActionType, setFolderActionType] = useState<'create' | 'restore'>('create');
  const [folderPath, setFolderPath] = useState('');
  const [permissionActions, setPermissionActions] = useState<string[]>(['read']);
  const [targetUser, setTargetUser] = useState('');
  const [aiModelName, setAiModelName] = useState('Gemini');
  const [aiPurposeOnly, setAiPurposeOnly] = useState('');

  const [success, setSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Synchronize Hardware category & action type when selectedCategory is 'hardware_request'
  useEffect(() => {
    if (selectedCategory === 'hardware_request') {
      // Sync deviceType to subcategory selection
      if (selectedSubcategory === 'desktop') {
        setDeviceType('Desktop');
      } else if (selectedSubcategory === 'laptop') {
        setDeviceType('Laptop');
      } else if (selectedSubcategory === 'monitor') {
        setDeviceType('Màn hình');
      } else if (selectedSubcategory === 'phone') {
        setDeviceType('Phone');
      } else if (selectedSubcategory === 'tablet') {
        setDeviceType('Tablet');
      } else if (selectedSubcategory === 'deskphone') {
        setDeviceType('Deskphone');
      } else if (selectedSubcategory === 'removable_disk') {
        setDeviceType('Removable Disk');
      } else if (selectedSubcategory === 'accessories') {
        const accessories = [
          'Keyboard',
          'Mouse',
          'Display Cable',
          'Other Cable',
          'Laptop Adaptor',
          'Mobile Charger',
          'Hub/Converter',
          'Expansions Card',
          'Network Hub'
        ];
        if (!accessories.includes(deviceType)) {
          setDeviceType('Keyboard');
        }
      }

      // Sync deviceActionType to type selection
      if (selectedType.endsWith('_new')) {
        setDeviceActionType('new');
      } else if (selectedType.endsWith('_repair')) {
        setDeviceActionType('repair');
      } else if (selectedType.endsWith('_replacement')) {
        setDeviceActionType('replace');
      } else if (selectedType.endsWith('_return')) {
        setDeviceActionType('return');
      }
    }

    if (selectedCategory === 'server_request') {
      if (selectedSubcategory === 'folder') {
        setServerAction('folder');
        if (selectedType === 'create_folder') {
          setFolderActionType('create');
        } else if (selectedType === 'restore_data') {
          setFolderActionType('restore');
        } else {
          setFolderActionType('create');
        }
      } else if (selectedSubcategory === 'permission') {
        setServerAction('permission');
        if (selectedType === 'read_folder') {
          setPermissionActions(['read']);
        } else if (selectedType === 'write_folder') {
          setPermissionActions(['read', 'write']);
        } else if (selectedType === 'modify_folder') {
          setPermissionActions(['read', 'write', 'modify']);
        } else if (selectedType === 'account_server') {
          setPermissionActions(['read', 'write', 'modify', 'full']);
        }
      } else if (selectedSubcategory === 'ai') {
        setServerAction('ai');
        if (selectedType === 'gemini') {
          setAiModelName('Gemini Enterprise Workspace API');
        } else if (selectedType === 'gpt') {
          setAiModelName('ChatGPT Plus Enterprise Account');
        } else if (selectedType === 'api_access') {
          setAiModelName('API Key Endpoint Secure Credential');
        }
      }
    }
  }, [selectedCategory, selectedSubcategory, selectedType]);

  // Dynamically calculate and update periodTo based on periodFrom and duration
  useEffect(() => {
    if (!periodFrom) {
      setPeriodTo('');
      return;
    }
    const startDate = new Date(periodFrom);
    if (isNaN(startDate.getTime())) {
      setPeriodTo('');
      return;
    }

    if (duration === 'By Project Term') {
      return;
    }

    const calculatedDate = new Date(startDate.getTime());
    if (duration === '1 Day') {
      calculatedDate.setDate(startDate.getDate() + 0);
    } else if (duration === '3 Days') {
      calculatedDate.setDate(startDate.getDate() + 2);
    } else if (duration === '1 Week') {
      calculatedDate.setDate(startDate.getDate() + 6);
    } else if (duration === '2 Weeks') {
      calculatedDate.setDate(startDate.getDate() + 13);
    } else if (duration === '1 Month') {
      calculatedDate.setMonth(startDate.getMonth() + 1);
      calculatedDate.setDate(calculatedDate.getDate() - 1);
    }

    const yyyy = calculatedDate.getFullYear();
    const mm = String(calculatedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(calculatedDate.getDate()).padStart(2, '0');
    setPeriodTo(`${yyyy}-${mm}-${dd}`);
  }, [periodFrom, duration]);

  // Handle category change -> auto select first subcategory & type
  const handleCategoryChange = (catId: string) => {
    setSelectedCategory(catId);
    const cat = taxonomy.find(c => c.id === catId);
    if (cat && cat.subcategories.length > 0) {
      const sub = cat.subcategories[0];
      setSelectedSubcategory(sub.id);
      if (sub.types && sub.types.length > 0) {
        setSelectedType(sub.types[0].id);
      }
    }
  };

  // Handle subcategory change -> auto select first type of that subcategory
  const handleSubcategoryChange = (subId: string) => {
    setSelectedSubcategory(subId);
    const cat = taxonomy.find(c => c.id === selectedCategory);
    if (cat) {
      const sub = cat.subcategories.find(s => s.id === subId);
      if (sub && sub.types && sub.types.length > 0) {
        setSelectedType(sub.types[0].id);
      }
    }
  };

  const togglePermission = (perm: string) => {
    if (permissionActions.includes(perm)) {
      setPermissionActions(permissionActions.filter((p: string) => p !== perm));
    } else {
      setPermissionActions([...permissionActions, perm]);
    }
  };

  // ---- Attachments ----
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = ''; // allow re-selecting the same file
    const accepted: File[] = [];
    for (const f of picked) {
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`"${f.name}" exceeds the 10 MB limit and was skipped.`);
        continue;
      }
      accepted.push(f);
    }
    setFiles((prev) => {
      const merged = [...prev, ...accepted].slice(0, MAX_FILES);
      if (prev.length + accepted.length > MAX_FILES) {
        toast.info(`Only the first ${MAX_FILES} files are kept per request.`);
      }
      return merged;
    });
  };

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  // ---- AI triage assist ----
  const handleTriage = async () => {
    if (!title.trim() && !description.trim()) {
      toast.info('Enter a title or description first so triage has something to work with.');
      return;
    }
    setTriaging(true);
    try {
      const res = await api.triage(title.trim() || 'Untitled', description.trim() || title.trim());
      setPriority(res.suggestedPriority);
      // Switch category if the suggestion exists in the taxonomy.
      const suggested = taxonomy.find((c) => c.id === res.suggestedCategory);
      if (suggested) handleCategoryChange(suggested.id);
      toast.success(`AI triage suggests priority "${res.suggestedPriority}" and routes to the matched group.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'AI triage is unavailable right now.');
    } finally {
      setTriaging(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg('Please enter the request title.');
      return;
    }
    if (!description.trim()) {
      setErrorMsg('Please describe your request or issue in detail.');
      return;
    }

    const currentCategoryObj = taxonomy.find(c => c.id === selectedCategory);
    const currentSubcategoryObj = currentCategoryObj?.subcategories.find(s => s.id === selectedSubcategory);
    const currentTypeObj = currentSubcategoryObj?.types.find(t => t.id === selectedType);

    if (currentTypeObj?.period === 'Apply') {
      if (!periodFrom || !periodTo) {
        setErrorMsg('Please specify the validity Period (Start and End dates) for this request type as it is authorized with an active Period limitation.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const { ticket } = await api.createTicket({
        title: title.trim(),
        description: description.trim(),
        requesterName: requesterName.trim() || user?.fullName || 'System User',
        requesterEmail: requesterEmail.trim() || user?.email || 'user@company.com',
        requesterDept: requesterDept,
        category: selectedCategory,
        subcategory: selectedSubcategory,
        type: selectedType || null,
        priority,
        periodFrom: currentTypeObj?.period === 'Apply' ? periodFrom : null,
        periodTo: currentTypeObj?.period === 'Apply' ? periodTo : null,
        details: {
          osType,
          softwareName,
          ipAddress,
          macAddress,
          wifiUserName,
          wifiDeviceType,
          sourceIp,
          destinationIp,
          protocolPort,
          firewallAction,
          deviceActionType,
          deviceType,
          deviceModelName,
          reasonForChange,
          usbDuration: currentTypeObj?.period === 'Apply' ? duration : usbDuration,
          usbJustification,
          decryptionFiles,
          pcSecurityHost,
          pcSecurityReason,
          serviceName,
          serviceDescription,
          serverAction,
          folderActionType,
          folderPath,
          permissionActionType: permissionActions,
          targetUser,
          aiModelName,
          aiPurposeOnly,
        },
      });

      // Upload staged attachments (best-effort; failures are surfaced but the
      // ticket is already created).
      if (files.length > 0) {
        try {
          await api.uploadAttachments(ticket.id, files);
        } catch (err) {
          toast.error(
            err instanceof ApiError
              ? `Ticket created, but attachments failed: ${err.message}`
              : 'Ticket created, but attachments failed to upload.',
          );
        }
      }

      setSuccess(ticket.code);
      toast.success(`Request ${ticket.code} submitted successfully.`);
      onCreated(ticket);

      // Reset form fields
      setTitle('');
      setDescription('');
      setSoftwareName('');
      setIpAddress('');
      setMacAddress('');
      setDestinationIp('');
      setFolderPath('');
      setTargetUser('');
      setPeriodFrom(getTodayString());
      setPeriodTo('');
      setPcSecurityHost('');
      setPcSecurityReason('');
      setAiPurposeOnly('');
      setFiles([]);
      setPriority('medium');

      setTimeout(() => setSuccess(null), 6000);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.details && err.details.length > 0
            ? `${err.message}: ${err.details.map((d) => d.message).join(', ')}`
            : err.message
          : 'Could not submit your request. Please try again.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const currentCategoryObj = taxonomy.find(c => c.id === selectedCategory);
  const currentSubcategoryObj = currentCategoryObj?.subcategories.find(s => s.id === selectedSubcategory);
  const currentTypeObj = currentSubcategoryObj?.types.find(t => t.id === selectedType);

  return (
    <div id="request-form-container" className="bg-white rounded-xl border border-slate-200 shadow-[0_2px_12px_rgba(0,0,0,0.015)] p-6 sm:p-8">
      <div className="border-b border-slate-200 pb-5 mb-6">
        <h3 className="text-xl font-extrabold text-slate-900 tracking-tight font-sans">New Request</h3>
        <p className="mt-1 text-xs text-slate-500 leading-relaxed font-sans">
          Complete the required fields for automated dispatch routing and live SLA assignment.
        </p>
      </div>

      {success && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-emerald-800 animate-fade-in-smooth">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm">Request Submitted Successfully!</h4>
            <p className="text-xs text-emerald-600 mt-1">
              Your VOC ID is <strong className="font-mono bg-emerald-100 px-1.5 py-0.5 rounded text-emerald-900">{success}</strong>. 
              You can track real-time resolution logs in the dashboard list below.
            </p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-800">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm">Validation Alert</h4>
            <p className="text-xs text-rose-600 mt-1">{errorMsg}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Requester Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider font-mono">Your Full Name</label>
            <input 
              type="text" 
              required
              value={requesterName}
              onChange={(e) => setRequesterName(e.target.value)}
              className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-100/50 focus:border-violet-600 transition-all bg-slate-50/50 hover:bg-slate-50 font-sans"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider font-mono">Corporate Email</label>
            <input 
              type="email" 
              required
              value={requesterEmail}
              onChange={(e) => setRequesterEmail(e.target.value)}
              className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-100/50 focus:border-violet-600 transition-all bg-slate-50/50 hover:bg-slate-50 font-sans"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider font-mono">Department / Suite</label>
            <select 
              value={requesterDept}
              onChange={(e) => setRequesterDept(e.target.value)}
              className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-100/50 focus:border-violet-600 transition-all bg-white font-medium text-slate-800 font-sans"
            >
              <option value="Engineering & Infrastructure">Engineering & Infrastructure</option>
              <option value="R&D / Software Engineering">R&D / Software Engineering</option>
              <option value="Finance & Audit Department">Finance & Audit Department</option>
              <option value="Marketing, Brand & PR">Marketing, Brand & PR</option>
              <option value="People & HR Suite">People & HR Suite</option>
              <option value="Executive Board / C-Suite">Executive Board / C-Suite</option>
            </select>
          </div>
        </div>

        {/* Section 2: Main Request Group */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-2.5 uppercase tracking-wider font-mono">Select Main IT Request Group</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {taxonomy.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategoryChange(cat.id)}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all cursor-pointer ${
                    isSelected 
                      ? 'border-violet-600 bg-violet-50/40 ring-1 ring-violet-600 text-violet-950 shadow-sm' 
                      : 'border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="mb-2 p-1.5 rounded-md bg-white border border-slate-200/60 shadow-xs">
                    {getCategoryIcon(cat.icon)}
                  </div>
                  <span className="text-[10px] font-extrabold leading-tight tracking-tight uppercase font-mono">{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 3: Classification Category & Type Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider font-mono">1. Category Selection</label>
            <select
              value={selectedSubcategory}
              onChange={(e) => handleSubcategoryChange(e.target.value)}
              className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-100/50 focus:border-violet-600 transition-all bg-white font-medium text-slate-800 font-sans"
            >
              {taxonomy.find(c => c.id === selectedCategory)?.subcategories.map(sub => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 mt-1.5 italic font-sans leading-tight">
              {taxonomy.find(c => c.id === selectedCategory)?.subcategories.find(s => s.id === selectedSubcategory)?.description}
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider font-mono">2. Type Selection</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-100/50 focus:border-violet-600 transition-all bg-white font-bold text-violet-800 font-sans"
            >
              {taxonomy.find(c => c.id === selectedCategory)
                ?.subcategories.find(s => s.id === selectedSubcategory)
                ?.types.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
            </select>
            {currentTypeObj && (
              <div className="mt-1.5 flex items-center justify-between text-[10px]">
                <span className="text-slate-400">Required Period Authorization:</span>
                <span className={`px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider ${currentTypeObj.period === 'Apply' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>
                  {currentTypeObj.period}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Period Selection form (Only shown when period format is "Apply") */}
        {currentTypeObj?.period === 'Apply' && (
          <div className="p-4 bg-violet-50/30 border border-violet-100 rounded-xl space-y-3.5 animate-fade-in-smooth">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-violet-800 uppercase tracking-widest font-mono">
              📅 Period Constraints Validation (Target Period)
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider font-mono">Authorization Start Date *</label>
                <input 
                  type="date"
                  required
                  value={periodFrom}
                  onChange={(e) => setPeriodFrom(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-250 bg-white text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider font-mono">Authorization End Date *</label>
                <input 
                  type="date"
                  required
                  value={periodTo}
                  onChange={(e) => setPeriodTo(e.target.value)}
                  disabled={duration !== 'By Project Term'}
                  className={`w-full text-xs px-3 py-2 rounded-lg border focus:outline-none transition-all font-sans font-medium ${
                    duration !== 'By Project Term' 
                      ? 'bg-slate-100/90 text-slate-450 border-slate-200 cursor-not-allowed select-none' 
                      : 'bg-white text-slate-800 border-slate-255 focus:ring-1 focus:ring-violet-400 focus:border-violet-400'
                  }`}
                />

              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider font-mono font-mono">Authorized Duration</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white font-medium text-slate-800"
                >
                  <option value="1 Day">1 Day</option>
                  <option value="3 Days">3 Days</option>
                  <option value="1 Week">1 Week</option>
                  <option value="2 Weeks">2 Weeks</option>
                  <option value="1 Month">1 Month</option>
                  <option value="By Project Term">By Project Term</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Category Specifications Form Sections */}
        <div className="p-5 rounded-xl bg-slate-50/40 border border-slate-200/70 space-y-4">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-2 mb-3 font-mono">
            <span>Specific Technical Detail Specifications</span>
            <span className="text-[9px] lowercase font-normal italic text-slate-400"> (Dynamically loaded according to your selected classification)</span>
          </div>

          {/* 1. General Request */}
          {selectedCategory === 'general_request' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in-smooth">
              {selectedSubcategory === 'troubleshooting' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Operating System (OS)</label>
                    <select
                      value={osType}
                      onChange={(e) => setOsType(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white"
                    >
                      <option value="Windows 11">Windows 11 Home/Pro</option>
                      <option value="Windows 10">Windows 10 Enterprise/Pro</option>
                      <option value="Linux Ubuntu/RHEL">Linux Ubuntu/RHEL</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 font-sans">Affected Software Name & Version</label>
                    <input
                      type="text"
                      placeholder="e.g. MS Outlook 365, Figma Pro, Adobe CC..."
                      value={softwareName}
                      onChange={(e) => setSoftwareName(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white font-sans"
                    />
                  </div>
                </>
              ) : (
                <div className="col-span-2">
                  <p className="text-xs text-slate-500 italic font-sans leading-relaxed">
                    * Support Night Shift requests are routed directly to the on-duty engineer's pager for emergency SLA responses.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 2. Network Request */}
          {selectedCategory === 'network_request' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in-smooth">
              {selectedSubcategory === 'network_registration' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Requested Static IP (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g., 10.20.15.55 or specific static block"
                      value={ipAddress}
                      onChange={(e) => setIpAddress(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Target Device MAC Address *</label>
                    <input
                      type="text"
                      required
                      placeholder="Format: AA:BB:CC:DD:EE:FF"
                      value={macAddress}
                      onChange={(e) => setMacAddress(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Domain Account / WiFi User</label>
                    <input
                      type="text"
                      placeholder="Domain username (e.g., alan.turing)"
                      value={wifiUserName}
                      onChange={(e) => setWifiUserName(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 font-sans">Access Device Type</label>
                    <select
                      value={wifiDeviceType}
                      onChange={(e) => setWifiDeviceType(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white font-sans"
                    >
                      <option value="Corporate Laptop">Corporate Laptop</option>
                      <option value="Mobile Phone (BYOD)">Mobile/BYOD Device</option>
                      <option value="Desktop Workstation">Desktop Workstation</option>
                    </select>
                  </div>
                </>
              ) : (
                <div className="col-span-2 space-y-3">
                  <label className="block text-xs font-semibold text-slate-700">Target System / Connection details</label>
                  <input
                    type="text"
                    placeholder="e.g. Deskphone model, connection failure description..."
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  />
                  <p className="text-[10px] text-slate-400 italic">Unblocks or call permissions require standard line routing guidelines.</p>
                </div>
              )}
            </div>
          )}

          {/* 3. Network Security */}
          {selectedCategory === 'network_security' && (
            <div className="space-y-3 animate-fade-in-smooth">
              {selectedSubcategory === 'firewall' ? (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Source IP / Segment</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 10.20.15.5"
                      value={sourceIp}
                      onChange={(e) => setSourceIp(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Destination IP Endpoint</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 192.168.100.12"
                      value={destinationIp}
                      onChange={(e) => setDestinationIp(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Protocol / Port</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. TCP-8080 or UDP-500"
                      value={protocolPort}
                      onChange={(e) => setProtocolPort(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Rules Policy Action</label>
                    <select
                      value={firewallAction}
                      onChange={(e) => setFirewallAction(e.target.value as 'allow' | 'deny')}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white font-bold"
                    >
                      <option value="allow" className="text-emerald-600">ALLOW</option>
                      <option value="deny" className="text-rose-600">DENY</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-100 rounded-lg">
                  <p className="text-xs text-slate-500 italic leading-relaxed">
                    * Network Security requests require secondary compliance authorization and Department Head digital audit signatures.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 4. Server Request */}
          {selectedCategory === 'server_request' && (
            <div className="space-y-4 animate-fade-in-smooth">
              {selectedSubcategory === 'folder' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in-smooth">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 font-sans">Folder Action</label>
                    <select
                      value={folderActionType}
                      onChange={(e) => setFolderActionType(e.target.value as any)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white font-medium font-sans"
                    >
                      <option value="create">Create New Workspace Folder</option>
                      <option value="restore">Restore Deleted File / Snapshot</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Server Root Folder Absolute Path *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., S:\Workspace\Active_Projects\..."
                      value={folderPath}
                      onChange={(e) => setFolderPath(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white font-mono"
                    />
                  </div>
                </div>
              )}

              {selectedSubcategory === 'permission' && (
                <div className="space-y-4 animate-fade-in-smooth">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Target End-User Account Username</label>
                      <input
                        type="text"
                        required
                        placeholder="Full Name or @company domain email"
                        value={targetUser}
                        onChange={(e) => setTargetUser(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white font-sans font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Target Shared Resource / Folder Path *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., S:\Finance\Audit_Reports\"
                        value={folderPath}
                        onChange={(e) => setFolderPath(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Requested Rights / Permission Levels (Multiple Choice)</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'read', label: 'Read-Only Access' },
                        { id: 'write', label: 'Write / Creation' },
                        { id: 'modify', label: 'Modify / Delete / Rename' },
                        { id: 'full', label: 'Full Control Rights' }
                      ].map((perm) => {
                        const isChecked = permissionActions.includes(perm.id);
                        return (
                          <button
                            key={perm.id}
                            type="button"
                            onClick={() => togglePermission(perm.id)}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                              isChecked
                                ? 'bg-violet-50 border-violet-400 text-violet-700 font-bold'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {perm.label} {isChecked ? '✓' : '+'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {selectedSubcategory === 'ai' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in-smooth">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 font-sans">AI Workspace Subscription / Model Type</label>
                    <input
                      type="text"
                      disabled
                      value={aiModelName}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 text-slate-500 font-medium font-sans select-none cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">AI Access Purpose & Justification *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., R&D automated code documentation assistance..."
                      value={aiPurposeOnly}
                      onChange={(e) => setAiPurposeOnly(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white font-sans font-medium"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 5. Security Request */}
          {selectedCategory === 'security_request' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in-smooth">
              {selectedSubcategory === 'e' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Requested USB Device Duration</label>
                    <select
                      value={usbDuration}
                      onChange={(e) => setUsbDuration(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white"
                    >
                      <option value="1 Day">1 Day Duration</option>
                      <option value="3 Days">3 Days Duration</option>
                      <option value="1 Week">1 Week Duration</option>
                      <option value="By Project Duration">Project Term Duration (Requires Executive Board Approval)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Administrative Reason / Justification</label>
                    <input
                      type="text"
                      placeholder="Backup off-site client assets..."
                      value={usbJustification}
                      onChange={(e) => setUsbJustification(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white"
                    />
                  </div>
                </>
              ) : selectedSubcategory === 'pc_security' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Target Hostname / Device IP</label>
                    <input
                      type="text"
                      placeholder="e.g., PC-KHOATPV-12A or 10.150.12.8"
                      value={pcSecurityHost}
                      onChange={(e) => setPcSecurityHost(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white font-sans font-medium"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Exemption Justification & Software Details</label>
                    <input
                      type="text"
                      placeholder="Testing un-signed compiled executable or MDS exception..."
                      value={pcSecurityReason}
                      onChange={(e) => setPcSecurityReason(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white font-sans font-medium"
                      required
                    />
                  </div>
                </>
              ) : (
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1 font-mono">Target Encryption Archive / Description</label>
                  <input
                    type="text"
                    placeholder="e.g., Audit_Reports_Q1_Secured.pdf or automatic comparison reason..."
                    value={decryptionFiles}
                    onChange={(e) => setDecryptionFiles(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1 font-sans">Requires a Department Head or Director digital signature.</p>
                </div>
              )}
            </div>
          )}

          {/* 6. Hardware Request */}
          {selectedCategory === 'hardware_request' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in-smooth">
              <div>
                <label className="block text-xs font-semibold text-slate-755 mb-1">Request Purpose / Action</label>
                <select
                  disabled
                  value={deviceActionType}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed font-medium"
                >
                  <option value="new">Procure New Hardware</option>
                  <option value="replace">Replace / Component Upgrade</option>
                  <option value="repair">Repair Diagnostic Handoff</option>
                  <option value="return">Return Hardware Asset</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-755 mb-1">Hardware Category</label>
                <select
                  disabled={selectedSubcategory !== 'accessories'}
                  value={deviceType}
                  onChange={(e) => setDeviceType(e.target.value)}
                  className={`w-full text-xs px-3 py-2 rounded-lg border border-slate-200 font-medium ${
                    selectedSubcategory === 'accessories' 
                      ? 'bg-white text-slate-900 cursor-pointer' 
                      : 'bg-slate-50 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {selectedSubcategory === 'accessories' ? (
                    <>
                      <option value="Keyboard">Keyboard</option>
                      <option value="Mouse">Mouse</option>
                      <option value="Display Cable">Display Cable</option>
                      <option value="Other Cable">Other Cable</option>
                      <option value="Laptop Adaptor">Laptop Adaptor</option>
                      <option value="Mobile Charger">Mobile Charger</option>
                      <option value="Hub/Converter">Hub/Converter</option>
                      <option value="Expansions Card">Expansions Card</option>
                      <option value="Network Hub">Network Hub</option>
                    </>
                  ) : (
                    <>
                      <option value="Desktop">Desktop (Corporate Workstation)</option>
                      <option value="Laptop">Laptop Workstation</option>
                      <option value="Màn hình">Monitor (External Display)</option>
                      <option value="Phone">Phone (Corporate Mobile)</option>
                      <option value="Tablet">Tablet (Utility Board)</option>
                      <option value="Deskphone">Deskphone (Voice Terminal)</option>
                      <option value="Removable Disk">Removable Disk (External Drive)</option>
                      <option value="Accessories">Accessories (Keyboard, Mouse, Headset...)</option>
                    </>
                  )}
                </select>
                {selectedSubcategory === 'accessories' && (
                  <span className="text-[9px] text-violet-600 font-medium block mt-1">
                    ✓ Select specific accessory type
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Section 4: General info - Title and description */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1.5 font-sans">Issue Title & Brief Summary *</label>
            <input 
              type="text" 
              required
              placeholder="e.g., Create Marketing shared directory, Swollen laptop battery overheating..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-sm px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-100/50 focus:border-violet-600 transition-all font-medium text-slate-900 bg-slate-50/10 hover:bg-slate-50/20 font-sans"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-bold text-slate-800 font-sans">Detailed Context & Justification *</label>
              <button
                type="button"
                onClick={handleTriage}
                disabled={triaging}
                className="flex items-center gap-1.5 text-[11px] font-bold text-violet-600 hover:text-violet-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Use AI to suggest a category and priority from your title/description"
              >
                {triaging ? <Spinner className="w-3.5 h-3.5" label="Analyzing…" /> : (<><Sparkles className="w-3.5 h-3.5" /> AI Triage Assist</>)}
              </button>
            </div>
            <textarea
              rows={4}
              required
              placeholder="State your request guidelines, system settings, desktop location, or error prompt context in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-sm px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-100/50 focus:border-violet-600 transition-all text-slate-800 bg-slate-50/10 hover:bg-slate-50/20 font-sans"
            />
          </div>

          {/* Priority selector */}
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1.5 font-sans">Priority Level</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TicketPriority)}
              className="w-full text-sm px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-100/50 focus:border-violet-600 transition-all font-medium text-slate-800 bg-white font-sans cursor-pointer"
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1.5 font-sans">Attachments <span className="text-slate-400 font-normal">(optional, up to {MAX_FILES} files / 10 MB each)</span></label>
            <label
              htmlFor="request-attachments"
              className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg border border-dashed border-slate-300 hover:border-violet-400 hover:bg-violet-50/30 text-slate-500 text-xs font-semibold cursor-pointer transition-all"
            >
              <Paperclip className="w-4 h-4" /> Click to attach screenshots, logs, or supporting documents
            </label>
            <input
              id="request-attachments"
              type="file"
              multiple
              onChange={handleFilesSelected}
              className="sr-only"
            />
            {files.length > 0 && (
              <ul className="mt-2.5 space-y-1.5">
                {files.map((f, idx) => (
                  <li
                    key={`${f.name}-${idx}`}
                    className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <FileText className="w-3.5 h-3.5 text-violet-600 shrink-0" />
                      <span className="truncate font-medium text-slate-700">{f.name}</span>
                      <span className="text-slate-400 font-mono shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      aria-label={`Remove ${f.name}`}
                      className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="pt-3 border-t border-slate-200/80 flex items-center justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-violet-600 hover:bg-violet-700 active:bg-violet-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-extrabold text-sm shadow-[0_2px_6px_rgba(124,58,237,0.15)] hover:shadow-[0_4px_12px_rgba(124,58,237,0.25)] transition-all cursor-pointer font-sans"
          >
            {submitting ? <Spinner label="Submitting…" /> : (<><Send className="w-4 h-4" /> Submit Request</>)}
          </button>
        </div>
      </form>
    </div>
  );
}
