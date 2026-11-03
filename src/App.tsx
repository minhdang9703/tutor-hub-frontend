import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppLayout } from './components/AppLayout'
import { MutationErrorToaster, QueryErrorReset } from './components/ErrorBoundary'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import VerifyEmailPage from './pages/auth/VerifyEmailPage'
import TutorBrowsePage from './pages/tutor/TutorBrowsePage'
import TutorDetailPage from './pages/tutor/TutorDetailPage'
import TutorArea from './pages/tutor/dashboard/TutorArea'
import ParentArea from './pages/parent/ParentArea'
import BookingListPage from './pages/booking/BookingListPage'
import OpenRequestsPage from './pages/request/OpenRequestsPage'
import MyRequestsPage from './pages/request/MyRequestsPage'
import RequestDetailPage from './pages/request/RequestDetailPage'
import MyApplicationsPage from './pages/request/MyApplicationsPage'
import NotificationsPage from './pages/notification/NotificationsPage'
import ConversationsPage from './pages/chat/ConversationsPage'
import ConversationDetailPage from './pages/chat/ConversationDetailPage'
import AdminArea from './pages/admin/AdminArea'
import NotFoundPage from './pages/NotFoundPage'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" toastOptions={{ className: 'text-sm', error: { duration: 6000 } }} />
      <MutationErrorToaster />
      <BrowserRouter>
        <AuthProvider>
          <QueryErrorReset>
            <Routes>
              <Route element={<AppLayout />}>
                <Route index element={<TutorBrowsePage />} />
                <Route path="tutors" element={<TutorBrowsePage />} />
                <Route path="tutors/:id" element={<TutorDetailPage />} />
                <Route path="login" element={<LoginPage />} />
                <Route path="register" element={<RegisterPage />} />
                <Route path="forgot-password" element={<ForgotPasswordPage />} />
                <Route path="reset-password" element={<ResetPasswordPage />} />
                <Route path="verify-email" element={<VerifyEmailPage />} />

                <Route
                  path="tutor/*"
                  element={
                    <ProtectedRoute roles={['TUTOR']}>
                      <TutorArea />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="parent"
                  element={
                    <ProtectedRoute roles={['PARENT']}>
                      <ParentArea />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="bookings"
                  element={
                    <ProtectedRoute roles={['PARENT', 'TUTOR']}>
                      <BookingListPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="requests"
                  element={
                    <ProtectedRoute roles={['TUTOR']}>
                      <OpenRequestsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="requests/mine"
                  element={
                    <ProtectedRoute roles={['PARENT']}>
                      <MyRequestsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="requests/:id"
                  element={
                    <ProtectedRoute roles={['PARENT', 'TUTOR']}>
                      <RequestDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="applications/mine"
                  element={
                    <ProtectedRoute roles={['TUTOR']}>
                      <MyApplicationsPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="notifications"
                  element={
                    <ProtectedRoute>
                      <NotificationsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="messages"
                  element={
                    <ProtectedRoute roles={['PARENT', 'TUTOR']}>
                      <ConversationsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="messages/:id"
                  element={
                    <ProtectedRoute roles={['PARENT', 'TUTOR']}>
                      <ConversationDetailPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="admin/*"
                  element={
                    <ProtectedRoute roles={['ADMIN']}>
                      <AdminArea />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </QueryErrorReset>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
