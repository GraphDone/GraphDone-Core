import { useState, useRef, useLayoutEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ChevronDown, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function UserSelector({ isCollapsed = false }: { isCollapsed?: boolean }) {
  const { currentUser, currentTeam, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8 });
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  useLayoutEffect(() => {
    if (!isOpen) return;
    const place = () => {
      if (!trigger.current || !panel.current) return;
      const anchor = trigger.current.getBoundingClientRect();
      const menu = panel.current.getBoundingClientRect();
      setPosition({
        left: Math.max(8, Math.min(anchor.right + 8, window.innerWidth - menu.width - 8)),
        top: Math.max(8, Math.min(anchor.bottom - menu.height, window.innerHeight - menu.height - 8)),
      });
    };
    const close = (event: MouseEvent) => {
      if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setIsOpen(false); trigger.current?.focus(); }
    };
    place();
    panel.current?.querySelector<HTMLElement>('a, button')?.focus();
    const observer = new ResizeObserver(place);
    if (panel.current) observer.observe(panel.current);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', key);
    return () => { observer.disconnect(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); document.removeEventListener('mousedown', close); document.removeEventListener('keydown', key); };
  }, [isOpen]);
  if (!currentUser) return null;
  return <>
    <button ref={trigger} data-testid="user-menu" aria-label={`Account: ${currentUser.name}`} aria-expanded={isOpen} aria-controls={isOpen ? id : undefined}
      onClick={() => setIsOpen(!isOpen)} className={`flex items-center gap-3 w-full min-h-[44px] p-2 text-left hover:bg-gray-700 rounded-lg ${isCollapsed ? 'justify-center' : ''}`}>
      <span className="shrink-0 w-9 h-9 rounded-full bg-violet-700 text-white flex items-center justify-center font-semibold">{currentUser.avatar || currentUser.name.charAt(0)}</span>
      {!isCollapsed && <><span className="min-w-0 flex-1"><span className="block text-sm text-gray-100 truncate">{currentUser.name}</span><span className="block text-xs text-gray-300 truncate">{currentUser.role}</span></span><ChevronDown className="w-4 h-4 shrink-0" /></>}
    </button>
    {isOpen && createPortal(<div ref={panel} id={id} data-testid="user-menu-dropdown" aria-label="Your account" role="region"
      style={position} className="fixed z-[1100] w-80 max-w-[calc(100vw-16px)] max-h-[calc(100dvh-16px)] overflow-y-auto rounded-xl border border-gray-600 bg-gray-800 text-gray-100 shadow-2xl p-3"
      onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node) && event.relatedTarget !== trigger.current) setIsOpen(false); }}>
      <div className="p-2 break-words"><p className="font-semibold">{currentUser.name}</p><p className="text-sm text-gray-300">{currentUser.email}</p><p className="mt-2 text-xs text-emerald-200">{currentUser.role}{currentTeam ? ` · ${currentTeam.name}` : ''}</p></div>
      <Link to="/settings" onClick={() => setIsOpen(false)} className="flex items-center gap-3 min-h-[44px] p-2 rounded-lg hover:bg-gray-700"><Settings className="w-4 h-4" />Account settings & usage</Link>
      <button onClick={() => { setIsOpen(false); logout(); }} className="flex items-center gap-3 w-full min-h-[44px] p-2 rounded-lg hover:bg-red-950 text-red-200"><LogOut className="w-4 h-4" />Logout</button>
    </div>, document.body)}
  </>;
}
