import React from "react";
import { Star } from "lucide-react";

export const LandingTestimonials: React.FC = () => {
  const testimonials = [
    {
      name: "Carlos Rossi",
      role: "Dueño de Autoservicio Los Pinos",
      city: "Buenos Aires",
      image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=120&h=120",
      content:
        "Antes tardábamos más de 2 horas cada noche cuadrando la caja en un cuaderno con calculadora. Con Jireh POS cerramos el turno en 3 minutos exactos y con el dinero exacto al centavo.",
      rating: 5,
      highlight: "Ahorro de 2 horas diarias",
    },
    {
      name: "Mariana Benítez",
      role: "Propietaria de Boutique Chic",
      city: "Córdoba",
      image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=120&h=120",
      content:
        "Las cuentas corrientes y las promociones 2x1 automáticas cambiaron la rentabilidad de mi local. Mis clientas están encantadas y yo puedo ver las ventas desde mi casa en mi teléfono.",
      rating: 5,
      highlight: "Control remoto desde el celular",
    },
    {
      name: "Roberto Méndez",
      role: "Gerente de Ferretería El Tornillo",
      city: "Rosario",
      image: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=120&h=120",
      content:
        "Tenemos más de 9.000 artículos en stock. La velocidad con lector de código de barras y la alerta de stock mínimo nos salvó de quedarnos sin productos en los momentos de mayor venta.",
      rating: 5,
      highlight: "Inventario de 9.000+ artículos",
    },
    {
      name: "Lucía Gómez",
      role: "Titular de Kiosco & Almacén Central",
      city: "Mendoza",
      image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=120&h=120",
      content:
        "Lo que más tranquilidad me da es el modo offline: si se corta el WiFi en el barrio sigo cobrando como si nada. Además, el equipo de soporte técnico me ayuda siempre al instante por WhatsApp.",
      rating: 5,
      highlight: "Sigue vendiendo sin internet",
    },
  ];

  return (
    <section id="testimonios" className="py-20 bg-white relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 uppercase tracking-wider">
            Casos de Éxito Reales
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Comerciantes que ya transformaron su día a día con{" "}
            <span className="bg-gradient-to-r from-sky-600 via-emerald-600 to-amber-600 bg-clip-text text-transparent">
              Jireh POS
            </span>
          </h2>
          <p className="mt-3 text-base sm:text-lg text-slate-600">
            Descubre por qué confían en nosotros para cobrar, controlar y crecer.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((t, idx) => (
            <div
              key={idx}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/50 p-6 shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
            >
              <div>
                {/* Estrellas */}
                <div className="flex items-center gap-1 text-amber-400 mb-3">
                  {[...Array(t.rating)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>

                <p className="text-xs sm:text-sm text-slate-700 italic leading-relaxed">
                  "{t.content}"
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200">
                <div className="flex items-center gap-3">
                  <img
                    src={t.image}
                    alt={t.name}
                    className="h-10 w-10 rounded-full object-cover border border-slate-200"
                  />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{t.name}</h4>
                    <p className="text-[11px] text-slate-500">{t.role}</p>
                    <span className="inline-block mt-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      {t.highlight}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
