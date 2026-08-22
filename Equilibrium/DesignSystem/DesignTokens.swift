import SwiftUI

enum EQColor {
    static let canvas = Color(red: 0.035, green: 0.043, blue: 0.055)
    static let surface = Color(red: 0.075, green: 0.086, blue: 0.105)
    static let elevatedSurface = Color(red: 0.11, green: 0.125, blue: 0.15)
    static let primaryText = Color.white
    static let secondaryText = Color.white.opacity(0.62)
    static let separator = Color.white.opacity(0.12)
    static let accent = Color(red: 0.45, green: 0.82, blue: 0.68)
    static let success = Color(red: 0.35, green: 0.78, blue: 0.50)
    static let warning = Color(red: 0.96, green: 0.68, blue: 0.28)
}
enum EQSpacing { static let xxs: CGFloat = 4; static let xs: CGFloat = 8; static let sm: CGFloat = 12; static let md: CGFloat = 16; static let lg: CGFloat = 24; static let xl: CGFloat = 32 }
enum EQRadius { static let compact: CGFloat = 8; static let control: CGFloat = 12; static let card: CGFloat = 20; static let hero: CGFloat = 28 }
enum EQTypography { static let display: Font = .largeTitle.bold(); static let title: Font = .title.bold(); static let sectionTitle: Font = .title2.weight(.semibold); static let cardHero: Font = .title.bold(); static let cardTitle: Font = .headline; static let exerciseTitle: Font = .title3.weight(.semibold); static let body: Font = .body; static let caption: Font = .caption }
enum EQDimension { static let minimumTouch: CGFloat = 44; static let inputHeight: CGFloat = 48 }
enum EQMotion { static let completion: Double = 0.35 }
enum EQPreferenceKey { static let weightUnit = "equilibrium.weight-unit" }

struct EQCardModifier: ViewModifier {
    var elevated = false
    func body(content: Content) -> some View {
        content
            .padding(EQSpacing.md)
            .background(elevated ? EQColor.elevatedSurface : EQColor.surface, in: RoundedRectangle(cornerRadius: EQRadius.card, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: EQRadius.card, style: .continuous).stroke(EQColor.separator))
    }
}

extension View {
    func eqCard(elevated: Bool = false) -> some View { modifier(EQCardModifier(elevated: elevated)) }
}
