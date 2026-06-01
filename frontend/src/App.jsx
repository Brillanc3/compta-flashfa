// frontend/src/App.jsx

import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/utils/queryClient';
import { CompanyProvider } from './contexts/CompanyContext';
import { Toaster } from 'react-hot-toast';
import ProtectedRoute from './components/ProtectedRoute';
import UpdateChecker from './components/UpdateChecker';
import CompanyRoute from '@/components/CompanyRoute.jsx';
import { useConfirmation } from "@/contexts/ConfirmationContext";


// Layouts
import DashboardLayout from './layouts/DashboardLayout';
import AdminLayout from "@/layouts/AdminLayout.jsx";

// Pages (publiques et protégées)
import HomePage from './pages/HomePage';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import ForbiddenPage from './pages/ForbiddenPage';
import StatusPage from './pages/StatusPage';
import NotFoundPage from "@/pages/NotFoundPage.jsx";


// Dashboard pages
import DashboardPage from './pages/DashboardPage';
import DevPage from './pages/dashboard/DevPage';
import UserProfile from './pages/dashboard/UserProfile';
import UserBillsPage from './pages/dashboard/UserBillsPage';
import UserPerksPage from './pages/dashboard/UserPerksPage';
import PerksCatalogPage from './pages/dashboard/PerksCatalogPage';
import CustomPagesManagementPage from "@/pages/dashboard/customPages/CustomPagesManagementPage.jsx";
import CustomPageCreatePage from "@/pages/dashboard/customPages/CustomPageCreatePage.jsx";
import CustomPageEditPage from "@/pages/dashboard/customPages/CustomPageEditPage.jsx";
import CustomPageViewPage from "@/pages/dashboard/customPages/CustomPageViewPage.jsx";
import HostedSiteViewPage from "@/pages/public/HostedSiteViewPage.jsx";
import HostingSitesPage from "@/pages/dashboard/hosting/HostingSitesPage.jsx";
import HostingSiteCreatePage from "@/pages/dashboard/hosting/HostingSiteCreatePage.jsx";
import HostingSiteEditPage from "@/pages/dashboard/hosting/HostingSiteEditPage.jsx";
import HostingDocsPage from "@/pages/dashboard/hosting/HostingDocsPage.jsx";
import ApiPage from "@/pages/dashboard/api/ApiPage.jsx";
import ApiDocsPage from "@/pages/dashboard/api/ApiDocsPage.jsx";
import EmployeesDocsPage from "@/pages/dashboard/api/docs/EmployeesDocsPage.jsx";
import RangsDocsPage from "@/pages/dashboard/api/docs/RangsDocsPage.jsx";
import GarageDocsPage from "@/pages/dashboard/api/docs/GarageDocsPage.jsx";
import ClientsDocsPage from "@/pages/dashboard/api/docs/ClientsDocsPage.jsx";
import ComptabiliteDocsPage from "@/pages/dashboard/api/docs/ComptabiliteDocsPage.jsx";
import ChatDocsPage from "@/pages/dashboard/api/docs/ChatDocsPage.jsx";
import BoxsDocsPage from "@/pages/dashboard/api/docs/BoxsDocsPage.jsx";
import InventoryDocsPage from "@/pages/dashboard/api/docs/InventoryDocsPage.jsx";

import CalendarPage from './pages/dashboard/CalendarPage';

// Entreprise (scopées & permissionnées)
import CompanySettingsPage from './pages/dashboard/CompanySettingsPage';
import DiscordIntegrationPage from './pages/dashboard/DiscordIntegrationPage';
import OnboardingPage from './pages/OnboardingPage';
import OnboardingCodesPage from './pages/dashboard/OnboardingCodesPage';
import CustomizationPage from './pages/dashboard/customization/CustomizationPage';

import EmployeeDetailPage from './pages/dashboard/EmployeeDetailPage';
import EmployeeManagementPage from './pages/dashboard/EmployeeManagementPage';
import RankDetailPage from './pages/dashboard/RankDetailPage';
import RankManagementPage from './pages/dashboard/RankManagementPage';

import FidelityCardViewerPage from './pages/FidelityCardViewerPage';
import FidelitySetupPage from './pages/dashboard/FidelitySetupPage';
import FidelityClientsPage from './pages/dashboard/FidelityClientsPage';
import ClientListPage from './pages/dashboard/ClientListPage';
import ClientDetailPage from './pages/dashboard/ClientDetailPage';
import ClientVariablesPage from './pages/dashboard/ClientVariablesPage';

import BillJournalPage from './pages/dashboard/BillJournalPage';
import TransactionJournalPage from "@/pages/dashboard/TransactionJournalPage.jsx";
import DeclarationPage from './pages/dashboard/DeclarationPage';
import ExpenseReportsPage from './pages/dashboard/ExpenseReportsPage';

import ProductListPage from '@/pages/dashboard/products/ProductListPage';
import ProductFormPage from '@/pages/dashboard/products/ProductFormPage';


// Admin
import AdminDashboardPage from "@/pages/admin/AdminDashboardPage.jsx";
import AdminRoute from "@/components/AdminRoute.jsx";
import BillingSupportPage from "@/pages/admin/BillingSupportPage.jsx";
import CompanyListPage from '@/pages/admin/CompanyListPage.jsx';
import CompanyDetailsPage from "@/pages/admin/CompanyDetailsPage.jsx";
import AdminLogsPage from "@/pages/admin/AdminLogsPage.jsx";
import AdminAnnouncementsPage from "@/pages/admin/AdminAnnouncementsPage.jsx";
import AdminImagesPage from "@/pages/admin/AdminImagesPage.jsx";
import TchatMonitoringPage from "@/pages/admin/TchatMonitoringPage.jsx";

// Modales / providers annexes (pas des pages)
import { NotificationProvider, useNotifications } from './contexts/NotificationContext';
import { ContractSigningModal } from "@/components/contracts/ContractSigningModal.jsx";
import SessionWarningModal from './components/auth/SessionWarningModal';
import AnnouncementModal from './components/AnnouncementModal';
import SessionLockScreen from './components/auth/SessionLockScreen';
import {ConfirmationProvider} from "@/contexts/ConfirmationContext.jsx";
import PartnerServicesPage from "@/pages/dashboard/partners/PartnerServicesPage.jsx";
import ServiceRenderedCreatePage from "@/pages/dashboard/partners/ServiceRenderedCreatePage.jsx";
import PartnerDetailPage from "@/pages/dashboard/partners/PartnerDetailPage.jsx";
import PartnersPage from "@/pages/dashboard/partners/PartnersPage.jsx";
import TabletCalendarPage from "@/pages/dashboard/TabletCalendarPage.jsx";
import InventoryPage from "@/pages/dashboard/InventoryPage.jsx";
import GaragePage from "@/pages/dashboard/GaragePage.jsx";
// CONTRATS
import CompanyContractsPage from "@/pages/dashboard/contracts/CompanyContractsPage.jsx";
import ContractViewPage from "@/pages/dashboard/contracts/ContractViewPage.jsx";
import ContractTemplatesPage from "@/pages/contracts/ContractTemplatesPage.jsx";
import ContractTemplateEditor from "@/pages/contracts/ContractTemplateEditor.jsx";
import CompanyContractAssignPage from "@/pages/contracts/CompanyContractAssignPage.jsx";
import ChatPage from "@/chat/pages/ChatPage.jsx";
import TchatV2Layout from "@/modules/tchatv2/pages/TchatV2Layout.jsx";
import ChatGateway from "@/modules/tchatv2/components/ChatGateway.jsx";
import { ChatEventsProvider } from "./contexts/ChatEventsContext";
import {WebSocketProvider} from "@/contexts/WebSocketContext.jsx";
import {PermissionsProvider} from "@/contexts/PermissionsContext.jsx";
import ProtectedCompanyRoute from "@/permissions/ProtectedCompanyRoute.jsx";
import ChatRealtimeListener from "@/chat/realtime/ChatRealtimeListener.jsx";
import ServicePage from "@/pages/dashboard/ServicePage.jsx";
import ResetTokenPage from "@/pages/ResetTokenPage.jsx";
import ProductDeclarationsPage from "@/pages/dashboard/products/ProductDeclarationsPage.jsx";
import ProductDeclarationsWeeklySummaryPage from "@/pages/dashboard/products/ProductDeclarationsWeeklySummaryPage.jsx";
import CartonSalesPage from "@/pages/dashboard/boxs/CartonSalesPage.jsx";
import DebugNavProbe from "@/debug/DebugNavProbe.jsx";
import PawnshopPurchasesPage from "@/pages/dashboard/pawnshop/PawnshopPurchasesPage.jsx";
import PawnshopManagePage from "@/pages/dashboard/pawnshop/PawnshopManagePage.jsx";
import PawnshopEstimationsPage from "@/pages/dashboard/pawnshop/PawnshopEstimationsPage.jsx";
import PawnshopStatsPage from "@/pages/dashboard/pawnshop/PawnshopStatsPage.jsx";
import PawnshopPublicSettingsPage from "@/pages/dashboard/pawnshop/PawnshopPublicSettingsPage.jsx";
import PawnshopPublicDocsPage from "@/pages/dashboard/pawnshop/PawnshopPublicDocsPage.jsx";
import PawnshopPublicPage from "@/pages/public/PawnshopPublicPage.jsx";
import TicketsPage from "@/pages/dashboard/tickets/TicketsPage.jsx";
import TicketDetailPage from "@/pages/dashboard/tickets/TicketDetailPage.jsx";
import AdminTicketsPage from "@/pages/admin/AdminTicketsPage.jsx";
import AdminTicketDetailPage from "@/pages/admin/AdminTicketDetailPage.jsx";
import ContractShareViewerPage from "@/pages/contracts/ContractShareViewerPage.jsx";
import ExternalLinkPage from "@/pages/dashboard/ExternalLinkPage.jsx";
import SacemPage from "@/pages/dashboard/SacemPage.jsx";
import RegiePage from "@/pages/dashboard/RegiePage.jsx";
import AnnouncementGeneratorPage from "@/pages/dashboard/AnnouncementGeneratorPage.jsx";
import StreamSourcePage from "@/pages/dashboard/StreamSourcePage.jsx";
import WorkflowEditor from "@/modules/automation/WorkflowEditor";
import ThemeInjector from "@/components/ThemeInjector.jsx";
import MyCalendarPage from "@/modules/myCalendar/CalendarPage";
import AdminQuizPage from "@/pages/admin/AdminQuizPage.jsx";
import QuizPage from "@/pages/QuizPage.jsx";
import InviteAcceptPage from "@/modules/tchatv2/pages/InviteAcceptPage.jsx";



const AppContent = () => {
    const { isSessionLocked } = useAuth();
    const { signingContractId, closeContractSignature } = useNotifications();
    const { confirmAction } = useConfirmation();

    useEffect(() => {
        const handleKeyDown = (event) => {
            if ((event.ctrlKey && event.shiftKey && event.key === "R")) {
                event.preventDefault();
                confirmAction({
                    title: "Rafraîchir la page ?",
                    message: "Toutes les modifications non sauvegardées seront perdues.",
                    onConfirm: () => window.location.reload()
                });
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [confirmAction]);


    useEffect(() => {
        const root = document.documentElement;
        const embeddedMobileAttr = "data-embedded-mobile-viewport";
        const embeddedMobileOffsetVar = "--embedded-mobile-viewport-offset";
        const mobileBreakpoint = 767;

        const updateEmbeddedMobileViewport = () => {
            let isInIframe = false;

            try {
                isInIframe = window.self !== window.top;
            } catch {
                isInIframe = true;
            }

            const isMobileViewport = window.matchMedia
                ? window.matchMedia(`(max-width: ${mobileBreakpoint}px)`).matches
                : window.innerWidth <= mobileBreakpoint;

            if (isInIframe && isMobileViewport) {
                root.setAttribute(embeddedMobileAttr, "true");
                root.style.setProperty(embeddedMobileOffsetVar, "50px");
                return;
            }

            root.removeAttribute(embeddedMobileAttr);
            root.style.removeProperty(embeddedMobileOffsetVar);
        };

        updateEmbeddedMobileViewport();
        window.addEventListener("resize", updateEmbeddedMobileViewport);
        window.addEventListener("orientationchange", updateEmbeddedMobileViewport);
        window.visualViewport?.addEventListener("resize", updateEmbeddedMobileViewport);

        return () => {
            window.removeEventListener("resize", updateEmbeddedMobileViewport);
            window.removeEventListener("orientationchange", updateEmbeddedMobileViewport);
            window.visualViewport?.removeEventListener("resize", updateEmbeddedMobileViewport);
            root.removeAttribute(embeddedMobileAttr);
            root.style.removeProperty(embeddedMobileOffsetVar);
        };
    }, []);

    return (
        <Router>
            <ContractSigningModal
                isOpen={!!signingContractId}
                contractId={signingContractId}
                onClose={closeContractSignature}
            />

            <Routes>
                {/* ===== Routes PUBLIQUES ===== */}
                <Route path="/" element={<HomePage />} />
                <Route path="/status" element={<StatusPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/reset-password" element={<ResetTokenPage />} />
                <Route path="/forbidden" element={<ForbiddenPage />} />
                <Route path="/fidelity/view/:publicLink" element={<FidelityCardViewerPage />} />
                <Route path="/onboarding" element={<OnboardingPage />} />
                <Route path="/contracts/share/:publicId" element={<ContractShareViewerPage />} />
                <Route path="/pawnshop/:slug" element={<PawnshopPublicPage />} />
                <Route path="/p/:slug" element={<HostedSiteViewPage />} />
                <Route path="/p/:slug/*" element={<HostedSiteViewPage />} />
                <Route path="/stream-source/:key" element={<StreamSourcePage />} />
                <Route path="/invite/:code" element={<InviteAcceptPage />} />
                <Route
                    path="/quiz/:token"
                    element={
                        <ProtectedRoute>
                            <QuizPage />
                        </ProtectedRoute>
                    }
                />

                {/* ===== Routes PROTÉGÉES (utilisateur connecté) ===== */}
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <DashboardLayout />
                        </ProtectedRoute>
                    }
                >

                    <Route index element={<DashboardPage />} />
                    <Route path="dev" element={<DevPage />} />
                    <Route path="me" element={<UserProfile />} />
                    <Route path="me/bills" element={<UserBillsPage />} />
                    <Route path="me/perks" element={<UserPerksPage />} />
                    <Route path="perks-catalog" element={<PerksCatalogPage />} />
                    <Route path="calendar"
                           element={
                               <ProtectedCompanyRoute
                                   module="employees"
                                   permissions={["EMPLOYEES.{companyId}.EMPLOYEES.VIEW"]}
                               >
                                    <CalendarPage />
                               </ProtectedCompanyRoute>
                           }
                    />
                    <Route path="services" element={<ServicePage />} />
                    <Route path="chat/*" element={<ChatGateway><ChatPage /></ChatGateway>} />
                    <Route path="tchatv2/*" element={<TchatV2Layout />} />

                    <Route
                        path="tickets"
                        element={<TicketsPage />}
                    />
 
                    <Route
                        path="external-link"
                        element={<ExternalLinkPage />}
                    />

                    <Route
                        path="automation"
                        element={<WorkflowEditor />}
                    />

                    <Route
                        path="mycalendar"
                        element={<MyCalendarPage />}
                    />

                    <Route
                        path="tickets/:ticketId"
                        element={<TicketDetailPage />}
                    />

                    {/* ----- ZONE SCOPÉE ENTREPRISE + MODULE + PERMISSIONS ----- */}
                    <Route
                        path="partners"
                        element={
                            <ProtectedCompanyRoute
                                module="partenariat"
                                permissions={["PARTENARIAT.ACCESS", "PARTENARIAT.PARTNER.LIST"]}
                            >
                                <PartnersPage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    <Route
                        path="partners/:partnerId"
                        element={
                            <ProtectedCompanyRoute
                                module="partenariat"
                                permissions={["PARTENARIAT.ACCESS", "PARTENARIAT.PARTNER.LIST"]}
                            >
                                <PartnerDetailPage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    <Route
                        path="partners/:partnerId/services"
                        element={
                            <ProtectedCompanyRoute
                                module="partenariat"
                                permissions={["PARTENARIAT.ACCESS", "PARTENARIAT.SERVICE_TYPE.LIST"]}
                            >
                                <PartnerServicesPage />
                            </ProtectedCompanyRoute>
                        }
                    />



                    <Route
                        path="partners/:partnerId/render"
                        element={
                            <ProtectedCompanyRoute
                                module="partenariat"
                                permissions={["PARTENARIAT.ACCESS", "PARTENARIAT.SERVICE_RENDERED.CREATE"]}
                            >
                                <ServiceRenderedCreatePage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    <Route
                        path="custom-pages"
                        element={
                            <ProtectedCompanyRoute
                                module="custom-pages"
                                permissions={["CUSTOM_PAGES.VIEW", "CUSTOM_PAGES.MANAGE"]}
                            >
                                <CustomPagesManagementPage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    <Route
                        path="custom-pages/new"
                        element={
                            <ProtectedCompanyRoute module="custom-pages" permissions={["CUSTOM_PAGES.MANAGE"]}>
                                <CustomPageCreatePage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    <Route
                        path="custom-pages/:id/edit"
                        element={
                            <ProtectedCompanyRoute module="custom-pages" permissions={["CUSTOM_PAGES.MANAGE"]}>
                                <CustomPageEditPage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    <Route
                        path="pages/:slug"
                        element={
                            <ProtectedCompanyRoute
                                module="custom-pages"
                                permissions={["CUSTOM_PAGES.VIEW", "CUSTOM_PAGES.MANAGE"]}
                            >
                                <CustomPageViewPage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    <Route
                        path="hosting"
                        element={
                            <ProtectedCompanyRoute module="hosting" permissions={["HOSTING.VIEW", "HOSTING.MANAGE"]}>
                                <HostingSitesPage />
                            </ProtectedCompanyRoute>
                        }
                    />
                    <Route
                        path="hosting/new"
                        element={
                            <ProtectedCompanyRoute module="hosting" permissions={["HOSTING.MANAGE"]}>
                                <HostingSiteCreatePage />
                            </ProtectedCompanyRoute>
                        }
                    />
                    <Route
                        path="hosting/:siteId/edit"
                        element={
                            <ProtectedCompanyRoute module="hosting" permissions={["HOSTING.MANAGE"]}>
                                <HostingSiteEditPage />
                            </ProtectedCompanyRoute>
                        }
                    />
                    <Route
                        path="hosting/docs"
                        element={
                            <ProtectedCompanyRoute module="hosting" permissions={["HOSTING.VIEW", "HOSTING.MANAGE"]}>
                                <HostingDocsPage />
                            </ProtectedCompanyRoute>
                        }
                    />
                    <Route
                        path="api"
                        element={
                            <ProtectedCompanyRoute module="api" permissions={["API.VIEW", "API.MANAGE"]}>
                                <ApiPage />
                            </ProtectedCompanyRoute>
                        }
                    />
                    <Route
                        path="api/docs"
                        element={
                            <ProtectedCompanyRoute module="api" permissions={["API.VIEW", "API.MANAGE"]}>
                                <ApiDocsPage />
                            </ProtectedCompanyRoute>
                        }
                    />
                    <Route
                        path="api/docs/employees"
                        element={
                            <ProtectedCompanyRoute module="api" permissions={["API.VIEW", "API.MANAGE"]}>
                                <EmployeesDocsPage />
                            </ProtectedCompanyRoute>
                        }
                    />
                    <Route
                        path="api/docs/rangs"
                        element={
                            <ProtectedCompanyRoute module="api" permissions={["API.VIEW", "API.MANAGE"]}>
                                <RangsDocsPage />
                            </ProtectedCompanyRoute>
                        }
                    />
                    <Route
                        path="api/docs/garage"
                        element={
                            <ProtectedCompanyRoute module="api" permissions={["API.VIEW", "API.MANAGE"]}>
                                <GarageDocsPage />
                            </ProtectedCompanyRoute>
                        }
                    />
                    <Route
                        path="api/docs/clients"
                        element={
                            <ProtectedCompanyRoute module="api" permissions={["API.VIEW", "API.MANAGE"]}>
                                <ClientsDocsPage />
                            </ProtectedCompanyRoute>
                        }
                    />
                    <Route
                        path="api/docs/comptabilite"
                        element={
                            <ProtectedCompanyRoute module="api" permissions={["API.VIEW", "API.MANAGE"]}>
                                <ComptabiliteDocsPage />
                            </ProtectedCompanyRoute>
                        }
                    />
                    <Route
                        path="api/docs/chat"
                        element={
                            <ProtectedCompanyRoute module="api" permissions={["API.VIEW", "API.MANAGE"]}>
                                <ChatDocsPage />
                            </ProtectedCompanyRoute>
                        }
                    />
                    <Route
                        path="api/docs/boxs"
                        element={
                            <ProtectedCompanyRoute module="api" permissions={["API.VIEW", "API.MANAGE"]}>
                                <BoxsDocsPage />
                            </ProtectedCompanyRoute>
                        }
                    />
                    <Route
                        path="api/docs/inventory"
                        element={
                            <ProtectedCompanyRoute module="api" permissions={["API.VIEW", "API.MANAGE"]}>
                                <InventoryDocsPage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    <Route
                        path="company/products/declarations"
                        element={
                            <ProtectedCompanyRoute
                                module="products"
                                permissions={[
                                    'PRODUCTS.VIEW_SELF',
                                    'PRODUCTS.{companyId}.DECLARATIONS.VIEW',
                                    'PRODUCTS.{companyId}.MANAGE',
                                ]}
                            >
                                <ProductDeclarationsPage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    <Route
                        path="company/pawnshop"
                        element={
                            <ProtectedCompanyRoute
                                module="pawnshop"
                                permissions={["PAWNSHOP.ACCESS"]}
                            >
                                <PawnshopPurchasesPage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    <Route
                        path="company/pawnshop/manage"
                        element={
                            <ProtectedCompanyRoute module="pawnshop" permissions={["PAWNSHOP.ACCESS"]}>
                                <PawnshopManagePage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    <Route
                        path="company/pawnshop/estimations"
                        element={
                            <ProtectedCompanyRoute module="pawnshop" permissions={["PAWNSHOP.ACCESS"]}>
                                <PawnshopEstimationsPage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    <Route
                        path="company/pawnshop/public-settings"
                        element={
                            <ProtectedCompanyRoute module="pawnshop" permissions={["PAWNSHOP.ACCESS"]}>
                                <PawnshopPublicSettingsPage />
                            </ProtectedCompanyRoute>
                        }
                    />
                    <Route
                        path="company/pawnshop/public-docs"
                        element={
                            <ProtectedCompanyRoute module="pawnshop" permissions={["PAWNSHOP.ACCESS"]}>
                                <PawnshopPublicDocsPage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    <Route
                        path="company/pawnshop/stats"
                        element={
                            <ProtectedCompanyRoute module="pawnshop" permissions={["PAWNSHOP.ACCESS"]}>
                                <PawnshopStatsPage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    <Route
                        path="company/products/declarations/weekly"
                        element={
                            <ProtectedCompanyRoute
                                module="products"
                                permissions={[
                                    'PRODUCTS.VIEW_SELF',
                                    'PRODUCTS.{companyId}.DECLARATIONS.VIEW',
                                    'PRODUCTS.{companyId}.MANAGE',
                                ]}
                            >
                                <ProductDeclarationsWeeklySummaryPage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    <Route
                        path="boxs/carton-sales"
                        element={
                            <ProtectedCompanyRoute
                                module="boxs"
                                permission={["BOXS.CARTON_SALES.VIEW"]}
                            >
                                <CartonSalesPage />
                            </ProtectedCompanyRoute>
                        }
                    />


                    <Route
                        path="company/clients"
                        element={
                            <ProtectedCompanyRoute
                                module="clients"
                                permissions={['CLIENTS.{companyId}.VIEW']}
                            >
                                <ClientListPage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    <Route
                        path="company/sacem"
                        element={
                            <ProtectedCompanyRoute
                                module="sacem"
                                permissions={['SACEM.{companyId}.VIEW', 'SACEM.{companyId}.VIEW_SELF']}
                            >
                                <SacemPage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    <Route
                        path="company/regie"
                        element={
                            <ProtectedCompanyRoute
                                module="regie"
                                permissions={['REGIE.{companyId}.VIEW']}
                            >
                                <RegiePage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    <Route
                        path="company/announcement-generator"
                        element={<AnnouncementGeneratorPage />}
                    />

                    <Route
                        path="company/clients/{clientId}"
                        element={
                            <ProtectedCompanyRoute
                                module="clients"
                                permissions={['CLIENTS.{companyId}.VIEW']}
                            >
                                <ClientDetailPage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    {/* RÔLES / GRADES */}
                    <Route
                        path="company/ranks"
                        element={
                            <ProtectedCompanyRoute
                                module="employees"
                                permissions={['EMPLOYEES.{companyId}.RANKS.VIEW']}
                            >
                                <RankManagementPage />
                            </ProtectedCompanyRoute>
                        }
                    />
                    <Route
                        path="company/ranks/:rankId"
                        element={
                            <ProtectedCompanyRoute
                                module="employees"
                                permissions={['EMPLOYEES.{companyId}.RANKS.VIEW']}
                            >
                                <RankDetailPage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    {/* DISCORD INTEGRATION */}
                    <Route
                        path="company/discord"
                        element={
                            <ProtectedCompanyRoute
                                module="discord"
                                permissions={['DISCORD.VIEW', 'DISCORD.MANAGE']}
                            >
                                <DiscordIntegrationPage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    {/* PARAMÈTRES ENTREPRISE (rattachés à comptabilité chez toi) */}
                    <Route
                        path="company/settings"
                        element={
                            <ProtectedCompanyRoute
                                module="comptabilite"
                                permissions={['COMPTABILITE.{companyId}.SETTINGS.EDIT']}
                            >
                                <CompanySettingsPage />
                            </ProtectedCompanyRoute>
                        }
                    />
                    <Route
                        path="company/customization"
                        element={
                            <ProtectedCompanyRoute
                                module="customization"
                                permissions={['COMPTABILITE.{companyId}.SETTINGS.EDIT']}
                            >
                                <CustomizationPage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    {/* ONBOARDING CODES */}


                    {/* FIDÉLITÉ */}
                    <Route
                        path="company/fidelity/setup"
                        element={
                            <ProtectedCompanyRoute
                                module="clients"
                                permissions={['CLIENTS.{companyId}.FIDELITY.MANAGE']}
                            >
                                <FidelitySetupPage />
                            </ProtectedCompanyRoute>
                        }
                    />
                    <Route
                        path="company/fidelity/clients"
                        element={
                            <ProtectedCompanyRoute
                                module="clients"
                                permissions={['CLIENTS.{companyId}.FIDELITY.MANAGE']}
                            >
                                <FidelityClientsPage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    {/* CLIENTS */}
                    <Route
                        path="company/:companyId/clients"
                        element={
                            <ProtectedCompanyRoute
                                module="clients"
                                permissions={['CLIENTS.{companyId}.VIEW']}
                            >
                                <ClientListPage />
                            </ProtectedCompanyRoute>
                        }
                    />
                    <Route
                        path="company/clients/:clientId"
                        element={
                            <ProtectedCompanyRoute
                                module="clients"
                                permissions={['CLIENTS.{companyId}.VIEW']}
                            >
                                <ClientDetailPage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    <Route
                        path="company/clients/variables"
                        element={
                            <ProtectedCompanyRoute
                                module="clients"
                                permissions={['clients.variables.manage']}
                            >
                                <ClientVariablesPage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    {/* EMPLOYÉS */}
                    <Route
                        path="company/employees"
                        element={
                            <ProtectedCompanyRoute
                                module="employees"
                                permissions={['EMPLOYEES.{companyId}.EMPLOYEES.VIEW']}
                            >
                                <EmployeeManagementPage />
                            </ProtectedCompanyRoute>
                        }
                    />
                    <Route
                        path="company/employees/:employeeId"
                        element={
                            <ProtectedCompanyRoute
                                module="employees"
                                permissions={['EMPLOYEES.{companyId}.EMPLOYEES.VIEW']}
                            >
                                <EmployeeDetailPage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    {/* COMPTABILITÉ */}
                    <Route
                        path="company/bills"
                        element={
                            <ProtectedCompanyRoute
                                module="comptabilite"
                                permissions={['COMPTABILITE.{companyId}.BILLS.VIEW_ALL']}
                            >
                                <BillJournalPage />
                            </ProtectedCompanyRoute>
                        }
                    />
                    <Route
                        path="company/journal"
                        element={
                            <ProtectedCompanyRoute
                                module="comptabilite"
                                permissions={['COMPTABILITE.{companyId}.TRANSACTIONS.VIEW']}
                            >
                                <TransactionJournalPage />
                            </ProtectedCompanyRoute>
                        }
                    />
                    <Route
                        path="company/declaration"
                        element={
                            <ProtectedCompanyRoute
                                module="comptabilite"
                                permissions={['COMPTABILITE.{companyId}.DECLARATION.VIEW']}
                            >
                                <DeclarationPage />
                            </ProtectedCompanyRoute>
                        }
                    />
                    <Route
                        path="company/expense-reports"
                        element={
                            <ProtectedCompanyRoute
                                module="comptabilite"
                                permissions={['COMPTABILITE.{companyId}.EXPENSE_REPORTS.MANAGE']}
                            >
                                <ExpenseReportsPage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    {/* PRODUITS */}
                    <Route
                        path="company/products"
                        element={
                            <ProtectedCompanyRoute
                                module="products"
                                permissions={['PRODUCTS.{companyId}.VIEW']}
                            >
                                <ProductListPage />
                            </ProtectedCompanyRoute>
                        }
                    />
                    <Route
                        path="company/products/new"
                        element={
                            <ProtectedCompanyRoute
                                module="products"
                                permissions={['PRODUCTS.{companyId}.MANAGE']}
                            >
                                <ProductFormPage />
                            </ProtectedCompanyRoute>
                        }
                    />
                    <Route
                        path="company/products/:id/edit"
                        element={
                            <ProtectedCompanyRoute
                                module="products"
                                permissions={['PRODUCTS.{companyId}.MANAGE']}
                            >
                                <ProductFormPage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    {/* PARTENARIAT */}
                    <Route
                        path="company/partners"
                        element={
                            <ProtectedCompanyRoute
                                module="partenariat"
                                permissions={['PARTENARIAT.{companyId}.ACCESS']}
                            >
                                <PartnersPage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    <Route
                        path="company/partners/:partnerId"
                        element={
                            <ProtectedCompanyRoute
                                module="partenariat"
                                permissions={['PARTENARIAT.{companyId}.PARTNER.LIST']}
                            >
                                <PartnerDetailPage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    <Route
                        path="company/partners/:partnerId/services"
                        element={
                            <ProtectedCompanyRoute
                                module="partenariat"
                                permissions={['PARTENARIAT.{companyId}.SERVICE_TYPE.LIST']}
                            >
                                <PartnerServicesPage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    <Route
                        path="company/partners/:partnerId/render"
                        element={
                            <ProtectedCompanyRoute
                                module="partenariat"
                                permissions={['PARTENARIAT.{companyId}.SERVICE_RENDERED.CREATE']}
                            >
                                <ServiceRenderedCreatePage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    <Route
                        path="company/inventory"
                        element={
                            <ProtectedCompanyRoute
                                module="inventory"
                                permissions={[
                                    'INVENTORY.{companyId}.VIEW_SELF',
                                    'INVENTORY.{companyId}.VIEW_ALL'
                                ]}
                            >
                                <InventoryPage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    <Route
                        path="company/garage"
                        element={
                            <ProtectedCompanyRoute
                                module="garage"
                                permissions={[
                                    'GARAGE.{companyId}.VIEW'
                                ]}
                            >
                                <GaragePage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    {/* ==== CONTRACTS MODULE ==== */}
                    <Route
                        path="company/contracts"
                        element={
                            <ProtectedCompanyRoute
                                module="contracts"
                                permissions={[
                                    'CONTRACTS.COMPANY_ASSIGNMENTS.VIEW.{companyId}'
                                ]}
                            >
                                <CompanyContractsPage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    <Route
                        path="company/contracts/templates"
                        element={
                            <ProtectedCompanyRoute
                                module="contracts"
                                permissions={[
                                    'CONTRACTS.TEMPLATE.LIST.{companyId}'
                                ]}
                            >
                                <ContractTemplatesPage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    <Route
                        path="company/contracts/templates/new"
                        element={
                            <ProtectedCompanyRoute
                                module="contracts"
                                permissions={[
                                    'CONTRACTS.TEMPLATE.CREATE.{companyId}'
                                ]}
                            >
                                <ContractTemplateEditor />
                            </ProtectedCompanyRoute>
                        }
                    />

                    <Route
                        path="company/contracts/templates/:templateId"
                        element={
                            <ProtectedCompanyRoute
                                module="contracts"
                                permissions={[
                                    'CONTRACTS.TEMPLATE.UPDATE.{companyId}'
                                ]}
                            >
                                <ContractTemplateEditor />
                            </ProtectedCompanyRoute>
                        }
                    />

                    <Route
                        path="company/contracts/assign"
                        element={
                            <ProtectedCompanyRoute
                                module="contracts"
                                permissions={[
                                    'CONTRACTS.ASSIGN.{companyId}'
                                ]}
                            >
                                <CompanyContractAssignPage />
                            </ProtectedCompanyRoute>
                        }
                    />

                    <Route
                        path="contracts/assigned/:assignedContractId"
                        element={<ContractViewPage />}
                    />
                </Route>

                <Route
                    path="/admin"
                    element={
                        <ProtectedCompanyRoute
                            permissions={[
                                'ADMIN.*',
                                'ADMIN.PANEL.ACCESS',
                            ]}
                        >
                            <AdminLayout />
                        </ProtectedCompanyRoute>
                    }
                >
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<AdminDashboardPage />} />
                    <Route
                        path="tickets"
                        element={
                            <ProtectedCompanyRoute
                                permissions={[
                                    'ADMIN.*',
                                    'ADMIN.TICKETS.*',
                                    'ADMIN.TICKETS.BILLS',
                                    'ADMIN.TICKETS.SUPPORT',
                                    'ADMIN.TICKETS.OTHERS',
                                ]}
                            >
                                <AdminTicketsPage />
                            </ProtectedCompanyRoute>
                        }
                    />
                    <Route
                        path="tickets/:ticketId"
                        element={
                            <ProtectedCompanyRoute
                                permissions={[
                                    'ADMIN.*',
                                    'ADMIN.TICKETS.*',
                                    'ADMIN.TICKETS.BILLS',
                                    'ADMIN.TICKETS.SUPPORT',
                                    'ADMIN.TICKETS.OTHERS',
                                ]}
                            >
                                <AdminTicketDetailPage />
                            </ProtectedCompanyRoute>
                        }
                    />
                    <Route
                        path="billing-support"
                        element={
                            <ProtectedCompanyRoute
                                permissions={[
                                    'ADMIN.*',
                                    'ADMIN.BILLING.SUPPORT.VIEW',
                                    'ADMIN.BILLING.SUPPORT.MANAGE'
                                ]}
                            >
                                <BillingSupportPage />
                            </ProtectedCompanyRoute>
                        }
                    />
                    <Route path="logs" element={<AdminLogsPage />} />
                    <Route
                        path="companies"
                        element={
                            <ProtectedCompanyRoute
                                permissions={[
                                    'ADMIN.*'
                                ]}
                            >
                                <CompanyListPage />
                            </ProtectedCompanyRoute>
                        }
                    />
                    <Route
                        path="companies/:companyId"
                        element={
                            <ProtectedCompanyRoute
                                permissions={[
                                    'ADMIN.*'
                                ]}
                            >
                                <CompanyDetailsPage />
                            </ProtectedCompanyRoute>
                        }
                    />
                    <Route
                        path="quiz"
                        element={
                            <ProtectedCompanyRoute
                                permissions={[
                                    'ADMIN.*',
                                    'ADMIN.QUIZ.SEND'
                                ]}
                            >
                                <AdminQuizPage />
                            </ProtectedCompanyRoute>
                        }
                    />
                    <Route
                        path="announcements"
                        element={
                            <ProtectedCompanyRoute
                                permissions={[
                                    'ADMIN.*',
                                    'ADMIN.ANNOUNCEMENT.VIEW',
                                    'ADMIN.ANNOUNCEMENT.MANAGE',
                                ]}
                            >
                                <AdminAnnouncementsPage />
                            </ProtectedCompanyRoute>
                        }
                    />
                    <Route
                        path="images"
                        element={
                            <ProtectedCompanyRoute
                                permissions={['ADMIN.*', 'ADMIN.IMAGE.MANAGE']}
                            >
                                <AdminImagesPage />
                            </ProtectedCompanyRoute>
                        }
                    />
                    <Route
                        path="tchat-monitoring"
                        element={
                            <ProtectedCompanyRoute
                                permissions={['ADMIN.*', 'ADMIN.PANEL.ACCESS']}
                            >
                                <TchatMonitoringPage />
                            </ProtectedCompanyRoute>
                        }
                    />
                </Route>


                {/* 404 */}
                <Route path="*" element={<NotFoundPage />} />
            </Routes>

            {isSessionLocked && <SessionLockScreen />}
            <SessionWarningModal />
            <AnnouncementModal />
        </Router>
    );
};
function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <WebSocketProvider>
                    <CompanyProvider>
                        <PermissionsProvider>
                            <ChatEventsProvider>
                                <NotificationProvider>
                                    <ConfirmationProvider>
                                        <Toaster
                                            position="top-right"
                                            toastOptions={{ duration: 1500 }}
                                        />
                                        <UpdateChecker />
                                        <ThemeInjector />
                                        <ChatRealtimeListener />
                                        <AppContent />
                                    </ConfirmationProvider>
                                </NotificationProvider>
                            </ChatEventsProvider>
                        </PermissionsProvider>
                    </CompanyProvider>
                </WebSocketProvider>
            </AuthProvider>
        </QueryClientProvider>
    );
}




export default App;
