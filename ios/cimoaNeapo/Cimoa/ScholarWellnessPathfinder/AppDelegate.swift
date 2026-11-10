import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        CimosyllabusActivityGraph.electiveCultureHorizon.libraryMobilityLens()
        return true
    }

    func application(_ application: UIApplication, configurationForConnecting session: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let diningCultureToolkit = UISceneConfiguration(name: CiCourseInterestWorkflow("DQefftaFudlbtR"), sessionRole: session.role)
        diningCultureToolkit.delegateClass = SceneDelegate.self
        return diningCultureToolkit
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        CimosyllabusActivityGraph.electiveCultureHorizon.libraryPersonalityTaxonomy(researchCampusWorkflow: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        CimosyllabusActivityGraph.electiveCultureHorizon.libraryPathwayStudio()
    }
}

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options: UIScene.ConnectionOptions) {
        guard let wellnessExplorationOrbit = scene as? UIWindowScene else { return }
        let wellnessScheduleLayer = UIWindow(windowScene: wellnessExplorationOrbit)
        wellnessScheduleLayer.rootViewController = CimoelectiveOrientationCompass()
        self.window = wellnessScheduleLayer
        wellnessScheduleLayer.makeKeyAndVisible()
    }
    func sceneDidBecomeActive(_ scene: UIScene) {
        (window?.rootViewController as? CimoelectiveOrientationCompass)?.orientationInnovationMap()
        CimosyllabusActivityGraph.electiveCultureHorizon.libraryMobilityLens()
    }
}
