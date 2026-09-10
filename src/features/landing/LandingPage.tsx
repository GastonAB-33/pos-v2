import React, { useState } from "react";
import { LandingNavbar } from "./components/LandingNavbar";
import { LandingHero } from "./components/LandingHero";
import { LandingStats } from "./components/LandingStats";
import { LandingAdvantages } from "./components/LandingAdvantages";
import { LandingTools } from "./components/LandingTools";
import { LandingCalculator } from "./components/LandingCalculator";
import { LandingPricing } from "./components/LandingPricing";
import { LandingTestimonials } from "./components/LandingTestimonials";
import { LandingFaq } from "./components/LandingFaq";
import { LandingFooter } from "./components/LandingFooter";
import { FreeTrialModal } from "./components/FreeTrialModal";
import { PaymentGatewayModal, type PlanDetails } from "./components/PaymentGatewayModal";

export const LandingPage: React.FC = () => {
  const [isFreeTrialOpen, setIsFreeTrialOpen] = useState(false);
  const [selectedPlanForTrial, setSelectedPlanForTrial] = useState('Plan "Me Estoy Formalizando"');

  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<PlanDetails>({
    id: "me-estoy-formalizando",
    name: 'Plan "Me Estoy Formalizando"',
    monthlyPrice: 40000,
    annualPricePerMonth: 32000,
    period: "monthly",
  });

  const handleOpenFreeTrial = (planName = 'Plan "Me Estoy Formalizando"') => {
    setSelectedPlanForTrial(planName);
    setIsFreeTrialOpen(true);
  };

  const handleOpenPayment = (plan: PlanDetails) => {
    setSelectedPlanForPayment(plan);
    setIsPaymentOpen(true);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col selection:bg-sky-500 selection:text-white font-sans antialiased">
      {/* Barra de navegación superior */}
      <LandingNavbar onOpenFreeTrial={() => handleOpenFreeTrial()} />

      {/* Cuerpo principal */}
      <main className="flex-1">
        {/* 1. Hero Principal */}
        <LandingHero onOpenFreeTrial={() => handleOpenFreeTrial()} />

        {/* 2. Estadísticas y Rubros adaptados */}
        <LandingStats />

        {/* 3. Ventajas Competitivas de Jireh */}
        <LandingAdvantages />

        {/* 4. Herramientas y Módulos del Sistema */}
        <LandingTools onOpenFreeTrial={() => handleOpenFreeTrial()} />

        {/* 5. Calculadora de Retorno y Ahorro */}
        <LandingCalculator onOpenFreeTrial={() => handleOpenFreeTrial()} />

        {/* 6. Planes y Pasarela de Pago */}
        <LandingPricing
          onOpenFreeTrial={(planName) => handleOpenFreeTrial(planName)}
          onOpenPayment={(plan) => handleOpenPayment(plan)}
        />

        {/* 7. Casos de Éxito / Testimonios */}
        <LandingTestimonials />

        {/* 8. Preguntas Frecuentes (FAQ) */}
        <LandingFaq />
      </main>

      {/* Pie de página y contacto */}
      <LandingFooter onOpenFreeTrial={() => handleOpenFreeTrial()} />

      {/* Modales globales */}
      <FreeTrialModal
        isOpen={isFreeTrialOpen}
        onClose={() => setIsFreeTrialOpen(false)}
        selectedPlanName={selectedPlanForTrial}
      />

      <PaymentGatewayModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        plan={selectedPlanForPayment}
      />
    </div>
  );
};
export default LandingPage;
