import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Bell,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Inbox,
  LogOut,
  Mail,
  Menu,
  Search,
  Settings,
  Shield,
  UserCog,
  Users,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'
import { dashboardPathForRole, useAuth } from '../auth/AuthContext'
import { ROLE_LABEL } from '../lib/labels'
import { NotificationBell } from './NotificationBell'

interface Leaf {
  to: string
  label: string
  icon: ReactNode
  /** "/admin" là đường dẫn cha của "/admin/users" nên cần khớp đúng để không sáng hai mục. */
  exact?: boolean
}

interface Branch {
  key: string
  label: string
  icon: ReactNode
  children: Leaf[]
}

type Node = Leaf | Branch

const isBranch = (node: Node): node is Branch => 'children' in node

const leafClass = ({ isActive }: { isActive: boolean }) =>
  clsx(
    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition',
    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  )

function isLeafActive(leaf: Leaf, pathname: string): boolean {
  return leaf.exact ? pathname === leaf.to : pathname === leaf.to || pathname.startsWith(`${leaf.to}/`)
}

export function AppLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const nodes = buildNavTree(user?.role)

  return (
    <div className={clsx('min-h-screen lg:grid', collapsed ? 'lg:grid-cols-1' : 'lg:grid-cols-[17rem_1fr]')}>
      <aside
        className={clsx(
          'sticky top-0 hidden h-screen flex-col border-r border-slate-200 bg-white',
          // Chỉ một variant display được áp; để cả lg:flex lẫn lg:hidden thì bên thắng phụ thuộc thứ tự CSS sinh ra.
          collapsed ? 'lg:hidden' : 'lg:flex',
        )}
      >
        <div className="flex justify-center border-b border-slate-100 px-4 py-5">
          <Link to="/" className="inline-block" aria-label="TutorHub — trang chủ">
            <img
              src="/logo.png"
              alt="TutorHub — Kết nối gia sư và phụ huynh"
              width={612}
              height={408}
              className="h-24 w-auto"
            />
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Điều hướng chính">
          <NavTree nodes={nodes} onNavigate={() => undefined} />
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 hidden h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-6 backdrop-blur lg:flex">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Mở thanh điều hướng' : 'Thu gọn thanh điều hướng'}
            title={collapsed ? 'Mở thanh điều hướng' : 'Thu gọn thanh điều hướng'}
            className="grid size-9 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
          >
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </button>

          <Breadcrumb nodes={nodes} />

          <div className="ml-auto flex items-center gap-3">
            <NotificationBell />
            {user ? (
              <UserMenu onSignOut={handleSignOut} />
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="text-sm font-medium text-slate-700 hover:text-brand-600">
                  Đăng nhập
                </Link>
                <Link
                  to="/register"
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Đăng ký
                </Link>
              </div>
            )}
          </div>
        </header>

        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur lg:hidden">
          <div className="flex h-16 items-center justify-between gap-3 px-4">
            <Link to="/" className="shrink-0" aria-label="TutorHub — trang chủ">
              <img
                src="/logo.png"
                alt="TutorHub — Kết nối gia sư và phụ huynh"
                width={612}
                height={408}
                className="h-14 w-auto"
              />
            </Link>
            <div className="flex items-center gap-1">
              {user && <NotificationBell />}
              {user && <UserMenu compact onSignOut={handleSignOut} />}
              <button
                className="grid size-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Menu"
              >
                {menuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
              </button>
            </div>
          </div>

          {menuOpen && (
            <div className="max-h-[70vh] overflow-y-auto border-t border-slate-100 bg-white px-4 py-3">
              <NavTree nodes={nodes} onNavigate={() => setMenuOpen(false)} />
              {/* Đã đăng xuất nằm trong UserMenu ở thanh ngang nên drawer chỉ lo phần chưa đăng nhập. */}
              {!user && (
                <div className="mt-3 flex flex-col gap-1">
                  <NavLink to="/login" className={leafClass} onClick={() => setMenuOpen(false)}>
                    Đăng nhập
                  </NavLink>
                  <NavLink to="/register" className={leafClass} onClick={() => setMenuOpen(false)}>
                    Đăng ký
                  </NavLink>
                </div>
              )}
            </div>
          )}
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }
}

/** Đường dẫn hiện tại khớp lá nào thì hiển thị "Nhóm / Trang" ở đầu thanh ngang. */
function Breadcrumb({ nodes }: { nodes: Node[] }) {
  const { pathname } = useLocation()
  const trail = findActiveTrail(pathname, nodes)

  return (
    <nav aria-label="Đường dẫn" className="min-w-0 truncate text-sm text-slate-500">
      {trail == null ? (
        <span className="font-medium text-slate-700">TutorHub</span>
      ) : (
        <>
          {trail.map((label, index) => (
            <span key={label}>
              {index > 0 && <span className="mx-2 text-slate-300">/</span>}
              <span className={index === trail.length - 1 ? 'font-semibold text-slate-800' : undefined}>{label}</span>
            </span>
          ))}
        </>
      )}
    </nav>
  )
}

function findActiveTrail(pathname: string, nodes: Node[]): string[] | null {
  for (const node of nodes) {
    if (!isBranch(node)) {
      if (isLeafActive(node, pathname)) return [node.label]
      continue
    }
    for (const child of node.children) {
      if (isLeafActive(child, pathname)) return [node.label, child.label]
    }
  }
  return null
}

function UserMenu({ compact = false, onSignOut }: { compact?: boolean; onSignOut: () => void }) {
  const { user } = useAuth()
  const location = useLocation()
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  // Giống NotificationBell: lưu route lúc mở nên đổi trang là menu tự đóng.
  const [openOnPath, setOpenOnPath] = useState<string | null>(null)
  const open = openOnPath != null && openOnPath === location.pathname

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const container = containerRef.current
      // "Node" trong file này là type của cây điều hướng nên phải trỏ tường minh tới DOM Node toàn cục.
      if (container != null && !container.contains(event.target as globalThis.Node)) setOpenOnPath(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpenOnPath(null)
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (user == null) return null

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpenOnPath(open ? null : location.pathname)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="user-menu-panel"
        aria-label={`Tài khoản ${user.fullName}`}
        className={clsx(
          'flex items-center gap-2.5 rounded-full py-1.5 text-left transition',
          compact ? 'px-1.5' : 'px-3 hover:bg-slate-100',
        )}
      >
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white"
        >
          {initialsOf(user.fullName)}
        </span>
        {!compact && (
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-slate-800">{user.fullName}</span>
            <span className="block truncate text-xs text-slate-500">{ROLE_LABEL[user.role]}</span>
          </span>
        )}
        {!compact && <ChevronDown className={clsx('size-4 shrink-0 text-slate-400 transition', open && 'rotate-180')} />}
      </button>

      {open && (
        <div
          id="user-menu-panel"
          role="menu"
          aria-label="Tài khoản"
          className="absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-semibold text-slate-800">{user.fullName}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>

          <div className="p-1.5">
            <MenuLink to={dashboardPathForRole(user.role)} onNavigate={() => setOpenOnPath(null)}>
              <Settings className="size-4" /> Bảng điều khiển
            </MenuLink>
            <MenuLink to="/notifications" onNavigate={() => setOpenOnPath(null)}>
              <Bell className="size-4" /> Thông báo
            </MenuLink>
          </div>

          <div className="border-t border-slate-100 p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={onSignOut}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              <LogOut className="size-4" /> Đăng xuất
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MenuLink({ to, onNavigate, children }: { to: string; onNavigate: () => void; children: ReactNode }) {
  return (
    <Link
      to={to}
      role="menuitem"
      onClick={onNavigate}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
    >
      {children}
    </Link>
  )
}

/** Tên tiếng Việt thường đảo họ trước: lấy 2 từ cuối làm chữ viết tắt cho avatar. */
function initialsOf(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  return words
    .slice(-2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
}

function NavTree({ nodes, onNavigate }: { nodes: Node[]; onNavigate: () => void }) {
  const { pathname } = useLocation()
  const [manual, setManual] = useState<Record<string, boolean>>({})

  return (
    <ul className="space-y-1">
      {nodes.map((node) => {
        if (!isBranch(node)) {
          return (
            <li key={node.to}>
              <NavLink to={node.to} end={node.exact} className={leafClass} onClick={onNavigate}>
                {node.icon}
                {node.label}
              </NavLink>
            </li>
          )
        }

        const active = node.children.some((child) => isLeafActive(child, pathname))
        const open = manual[node.key] ?? active

        return (
          <li key={node.key}>
            <button
              type="button"
              onClick={() => setManual((prev) => ({ ...prev, [node.key]: !open }))}
              aria-expanded={open}
              className={clsx(
                // text-left là cần thiết: UA stylesheet cho <button> text-align:center, nếu bỏ thì nhãn branch bị căn giữa lệch với lá.
                'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-semibold transition',
                active ? 'text-brand-700' : 'text-slate-700 hover:bg-slate-100',
              )}
            >
              {node.icon}
              <span className="min-w-0 flex-1 truncate">{node.label}</span>
              <ChevronRight className={clsx('size-4 shrink-0 text-slate-400 transition-transform', open && 'rotate-90')} />
            </button>

            {open && (
              <ul className="mt-1 space-y-1 border-l border-slate-200 pl-2">
                {node.children.map((child) => (
                  <li key={child.to}>
                    <NavLink to={child.to} end={child.exact} className={leafClass} onClick={onNavigate}>
                      {child.icon}
                      {child.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function buildNavTree(role: string | undefined): Node[] {
  const nodes: Node[] = [{ to: '/tutors', label: 'Tìm gia sư', icon: <Search className="size-4" /> }]

  if (role === 'PARENT') {
    nodes.push({
      key: 'parent',
      label: 'Phụ huynh',
      icon: <BookOpen className="size-4" />,
      children: [
        { to: '/parent', label: 'Hồ sơ phụ huynh', icon: <UserCog className="size-4" /> },
        { to: '/requests/mine', label: 'Yêu cầu của tôi', icon: <FileText className="size-4" /> },
      ],
    })
  }

  if (role === 'TUTOR') {
    nodes.push({
      key: 'tutor',
      label: 'Gia sư',
      icon: <UserCog className="size-4" />,
      children: [
        { to: '/tutor', label: 'Hồ sơ của tôi', icon: <Settings className="size-4" /> },
        { to: '/requests', label: 'Việc tìm gia sư', icon: <FileText className="size-4" /> },
        { to: '/applications/mine', label: 'Đơn đã ứng tuyển', icon: <Inbox className="size-4" /> },
      ],
    })
  }

  if (role === 'PARENT' || role === 'TUTOR') {
    nodes.push({
      key: 'activity',
      label: 'Hoạt động của tôi',
      icon: <CalendarDays className="size-4" />,
      children: [
        { to: '/bookings', label: 'Lịch học', icon: <CalendarDays className="size-4" /> },
        { to: '/messages', label: 'Tin nhắn', icon: <Mail className="size-4" /> },
        { to: '/notifications', label: 'Thông báo', icon: <Bell className="size-4" /> },
      ],
    })
  }

  if (role === 'ADMIN') {
    nodes.push({
      key: 'admin',
      label: 'Quản trị',
      icon: <Shield className="size-4" />,
      children: [
        { to: '/admin', label: 'Tổng quan', icon: <Users className="size-4" />, exact: true },
        { to: '/admin/tutors', label: 'Duyệt gia sư', icon: <UserCog className="size-4" /> },
        { to: '/admin/users', label: 'Người dùng', icon: <Users className="size-4" /> },
        { to: '/admin/reports', label: 'Báo cáo', icon: <FileText className="size-4" /> },
        { to: '/admin/audit', label: 'Nhật ký', icon: <Inbox className="size-4" /> },
      ],
    })
  }

  return nodes
}
