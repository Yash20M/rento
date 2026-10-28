import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'generated/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale) : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate = _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates = <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en')
  ];

  /// Product name shown in the OS app switcher.
  ///
  /// In en, this message translates to:
  /// **'Rento'**
  String get appName;

  /// Heading shown for an unknown route.
  ///
  /// In en, this message translates to:
  /// **'Page not found'**
  String get notFoundTitle;

  /// Button on the not-found screen that returns to the home screen.
  ///
  /// In en, this message translates to:
  /// **'Back to home'**
  String get notFoundAction;

  /// Chip shown on non-production builds so testers know which backend they are on.
  ///
  /// In en, this message translates to:
  /// **'Environment: {flavor}'**
  String envFlavorLabel(String flavor);

  /// Heading of the boot-failure screen shown when the build configuration is invalid.
  ///
  /// In en, this message translates to:
  /// **'Rento cannot start'**
  String get envErrorTitle;

  /// Button that repeats a failed request.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get actionRetry;

  /// Generic cancel button.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get actionCancel;

  /// Closes a dialog or sheet.
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get actionClose;

  /// Shown when no response arrived from the server.
  ///
  /// In en, this message translates to:
  /// **'Cannot reach Rento. Check your connection and try again.'**
  String get errorNetwork;

  /// Shown for an unexpected failure.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong. Please try again.'**
  String get errorGeneric;

  /// Shown when the server asks the app to retry shortly.
  ///
  /// In en, this message translates to:
  /// **'Rento is busy right now. Please try again in a moment.'**
  String get errorBusy;

  /// Shown when a list or screen failed to load.
  ///
  /// In en, this message translates to:
  /// **'We could not load this.'**
  String get errorLoading;

  /// Validation message for an empty required field.
  ///
  /// In en, this message translates to:
  /// **'Required'**
  String get fieldRequired;

  /// Heading of the sign-in screen.
  ///
  /// In en, this message translates to:
  /// **'Welcome back'**
  String get loginTitle;

  /// Sub-heading of the sign-in screen.
  ///
  /// In en, this message translates to:
  /// **'Sign in to book and manage your rentals.'**
  String get loginSubtitle;

  /// Heading of the registration screen.
  ///
  /// In en, this message translates to:
  /// **'Create your account'**
  String get registerTitle;

  /// Sub-heading of the registration screen.
  ///
  /// In en, this message translates to:
  /// **'It takes a minute. You can rent right after.'**
  String get registerSubtitle;

  /// Label of the email field.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get emailLabel;

  /// Label of the password field.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get passwordLabel;

  /// Hint under the new-password field.
  ///
  /// In en, this message translates to:
  /// **'At least 10 characters'**
  String get passwordHint;

  /// Label of the name field.
  ///
  /// In en, this message translates to:
  /// **'Your name'**
  String get nameLabel;

  /// Sign-in button.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get signInAction;

  /// Registration button.
  ///
  /// In en, this message translates to:
  /// **'Create account'**
  String get registerAction;

  /// Link from sign-in to registration.
  ///
  /// In en, this message translates to:
  /// **'New to Rento? Create an account'**
  String get goToRegister;

  /// Link from registration to sign-in.
  ///
  /// In en, this message translates to:
  /// **'Already have an account? Sign in'**
  String get goToLogin;

  /// Shown after a failed sign-in (one message for every cause).
  ///
  /// In en, this message translates to:
  /// **'Incorrect email or password.'**
  String get loginFailed;

  /// Shown when registering with a taken email.
  ///
  /// In en, this message translates to:
  /// **'An account with this email already exists. Try signing in.'**
  String get emailTakenError;

  /// Sign-out button.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get signOutAction;

  /// Bottom navigation: find drawers and items.
  ///
  /// In en, this message translates to:
  /// **'Explore'**
  String get tabExplore;

  /// Bottom navigation: the customer's bookings.
  ///
  /// In en, this message translates to:
  /// **'My bookings'**
  String get tabBookings;

  /// Bottom navigation: account and sign-out.
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get tabAccount;

  /// Heading of the account screen.
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get accountTitle;

  /// Shows who is signed in.
  ///
  /// In en, this message translates to:
  /// **'Signed in as {email}'**
  String signedInAs(String email);

  /// Fallback when the account has no email.
  ///
  /// In en, this message translates to:
  /// **'your account'**
  String get unknownUser;

  /// Heading of the home screen.
  ///
  /// In en, this message translates to:
  /// **'Find a drawer'**
  String get exploreTitle;

  /// Shows around which place drawers are searched.
  ///
  /// In en, this message translates to:
  /// **'Near {place}'**
  String searchingNear(String place);

  /// Name of the current-position place.
  ///
  /// In en, this message translates to:
  /// **'your location'**
  String get placeMyLocation;

  /// Opens the location chooser.
  ///
  /// In en, this message translates to:
  /// **'Change'**
  String get changeLocation;

  /// Title of the location chooser.
  ///
  /// In en, this message translates to:
  /// **'Where are you?'**
  String get chooseLocationTitle;

  /// Asks for the device position.
  ///
  /// In en, this message translates to:
  /// **'Use my location'**
  String get useMyLocation;

  /// Heading above preset locations (non-production builds).
  ///
  /// In en, this message translates to:
  /// **'Demo locations'**
  String get demoLocationsHeading;

  /// Heading above the manual latitude/longitude fields.
  ///
  /// In en, this message translates to:
  /// **'Or enter coordinates'**
  String get enterCoordinates;

  /// Label of the latitude field.
  ///
  /// In en, this message translates to:
  /// **'Latitude'**
  String get latitudeLabel;

  /// Label of the longitude field.
  ///
  /// In en, this message translates to:
  /// **'Longitude'**
  String get longitudeLabel;

  /// Applies the entered coordinates.
  ///
  /// In en, this message translates to:
  /// **'Search here'**
  String get searchHere;

  /// Validation message for the coordinate fields.
  ///
  /// In en, this message translates to:
  /// **'Latitude is −90 to 90 and longitude −180 to 180.'**
  String get coordinatesInvalid;

  /// Location failure.
  ///
  /// In en, this message translates to:
  /// **'Location services are turned off on this device.'**
  String get locationServicesOff;

  /// Location failure.
  ///
  /// In en, this message translates to:
  /// **'Location permission was not granted. You can choose a place instead.'**
  String get locationDenied;

  /// Location failure.
  ///
  /// In en, this message translates to:
  /// **'Location permission is blocked. Enable it in settings or choose a place instead.'**
  String get locationDeniedForever;

  /// Location failure.
  ///
  /// In en, this message translates to:
  /// **'We could not find your position. Choose a place instead.'**
  String get locationUnavailable;

  /// Empty nearby list.
  ///
  /// In en, this message translates to:
  /// **'No drawers are open near here right now.'**
  String get nearbyEmpty;

  /// Shown for OUTSIDE_SERVICE_AREA.
  ///
  /// In en, this message translates to:
  /// **'Rento is not available near this location yet.'**
  String get outsideServiceArea;

  /// Drawer is open.
  ///
  /// In en, this message translates to:
  /// **'Open now'**
  String get drawerOpenNow;

  /// Drawer is closed.
  ///
  /// In en, this message translates to:
  /// **'Closed now'**
  String get drawerClosedNow;

  /// Distance to a drawer.
  ///
  /// In en, this message translates to:
  /// **'{distance} away'**
  String distanceAway(String distance);

  /// Heading above drawers that are close but closed or out of stock.
  ///
  /// In en, this message translates to:
  /// **'Nearby, but not available right now'**
  String get unavailableHeading;

  /// Why a nearby drawer is not offered.
  ///
  /// In en, this message translates to:
  /// **'Closed'**
  String get reasonClosed;

  /// Why a nearby drawer is not offered.
  ///
  /// In en, this message translates to:
  /// **'Out of stock'**
  String get reasonOutOfStock;

  /// Heading of the drawer screen.
  ///
  /// In en, this message translates to:
  /// **'Drawer'**
  String get drawerHeading;

  /// Heading above the items of a drawer.
  ///
  /// In en, this message translates to:
  /// **'What you can rent here'**
  String get itemsHeading;

  /// Drawer with no items.
  ///
  /// In en, this message translates to:
  /// **'Nothing to rent here yet.'**
  String get itemsEmpty;

  /// Free units right now.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =0{None free right now} =1{1 available now} other{{count} available now}}'**
  String availableNowCount(int count);

  /// Price of one slot.
  ///
  /// In en, this message translates to:
  /// **'{price} per {minutes} min'**
  String pricePerSlot(String price, int minutes);

  /// Heading above where/how to pick up.
  ///
  /// In en, this message translates to:
  /// **'Pickup instructions'**
  String get pickupInstructions;

  /// Heading above the weekly hours.
  ///
  /// In en, this message translates to:
  /// **'Opening hours'**
  String get hoursHeading;

  /// A weekday without opening hours.
  ///
  /// In en, this message translates to:
  /// **'Closed'**
  String get hoursClosedDay;

  /// Short weekday name.
  ///
  /// In en, this message translates to:
  /// **'Mon'**
  String get weekdayShort1;

  /// Short weekday name.
  ///
  /// In en, this message translates to:
  /// **'Tue'**
  String get weekdayShort2;

  /// Short weekday name.
  ///
  /// In en, this message translates to:
  /// **'Wed'**
  String get weekdayShort3;

  /// Short weekday name.
  ///
  /// In en, this message translates to:
  /// **'Thu'**
  String get weekdayShort4;

  /// Short weekday name.
  ///
  /// In en, this message translates to:
  /// **'Fri'**
  String get weekdayShort5;

  /// Short weekday name.
  ///
  /// In en, this message translates to:
  /// **'Sat'**
  String get weekdayShort6;

  /// Short weekday name.
  ///
  /// In en, this message translates to:
  /// **'Sun'**
  String get weekdayShort7;

  /// Heading above the day chips.
  ///
  /// In en, this message translates to:
  /// **'Choose a day'**
  String get chooseDay;

  /// Heading above the start-time chips.
  ///
  /// In en, this message translates to:
  /// **'Choose a start time'**
  String get chooseStart;

  /// Heading above the duration chips.
  ///
  /// In en, this message translates to:
  /// **'How long?'**
  String get chooseDuration;

  /// Tells which time zone the slot times are in.
  ///
  /// In en, this message translates to:
  /// **'Times are in {zone}'**
  String timesInZone(String zone);

  /// Day without bookable starts.
  ///
  /// In en, this message translates to:
  /// **'No times are available on this day.'**
  String get noSlots;

  /// Day without opening hours.
  ///
  /// In en, this message translates to:
  /// **'The drawer is closed on this day.'**
  String get closedThisDay;

  /// Label of a duration chip.
  ///
  /// In en, this message translates to:
  /// **'{duration}'**
  String durationLabel(String duration);

  /// Whole hours.
  ///
  /// In en, this message translates to:
  /// **'{hours} h'**
  String durationHours(int hours);

  /// Minutes only.
  ///
  /// In en, this message translates to:
  /// **'{minutes} min'**
  String durationMinutes(int minutes);

  /// Hours and minutes.
  ///
  /// In en, this message translates to:
  /// **'{hours} h {minutes} min'**
  String durationHoursMinutes(int hours, int minutes);

  /// Price line.
  ///
  /// In en, this message translates to:
  /// **'Rental'**
  String get summaryRental;

  /// Price line.
  ///
  /// In en, this message translates to:
  /// **'Deposit (returned when you bring it back)'**
  String get summaryDeposit;

  /// Price line.
  ///
  /// In en, this message translates to:
  /// **'Total'**
  String get summaryTotal;

  /// Creates the hold and goes to payment.
  ///
  /// In en, this message translates to:
  /// **'Reserve & pay'**
  String get reserveAction;

  /// Shown for BOOKING_SLOT_TAKEN.
  ///
  /// In en, this message translates to:
  /// **'Someone just took that time. Please pick another.'**
  String get slotTakenError;

  /// Shown for LEAD_TIME_VIOLATION.
  ///
  /// In en, this message translates to:
  /// **'That start is too soon or too far ahead. Please pick another time.'**
  String get leadTimeError;

  /// Shown for DRAWER_CLOSED.
  ///
  /// In en, this message translates to:
  /// **'The drawer is closed at that time. Please pick another.'**
  String get drawerClosedError;

  /// Shown for DURATION_INVALID.
  ///
  /// In en, this message translates to:
  /// **'That length is not available. Please pick another.'**
  String get durationInvalidError;

  /// Explains that availability is a snapshot.
  ///
  /// In en, this message translates to:
  /// **'Availability can change while you decide; we check again when you reserve.'**
  String get snapshotNote;

  /// Heading of the payment screen.
  ///
  /// In en, this message translates to:
  /// **'Complete your booking'**
  String get checkoutTitle;

  /// Countdown of the hold.
  ///
  /// In en, this message translates to:
  /// **'We are holding this for you for {time}'**
  String holdCountdown(String time);

  /// Shown when the hold expired.
  ///
  /// In en, this message translates to:
  /// **'Time ran out'**
  String get holdExpiredTitle;

  /// Shown when the hold expired.
  ///
  /// In en, this message translates to:
  /// **'The slot was released. Please choose a time again.'**
  String get holdExpiredBody;

  /// Pay button.
  ///
  /// In en, this message translates to:
  /// **'Pay {amount}'**
  String payAction(String amount);

  /// Shown while the fake payment provider is used.
  ///
  /// In en, this message translates to:
  /// **'Demo payment: no money is charged.'**
  String get demoPaymentNote;

  /// Shown for PAYMENT_INVALID.
  ///
  /// In en, this message translates to:
  /// **'The payment could not be confirmed. You were not charged. Please try again.'**
  String get paymentFailed;

  /// Cancels an unpaid hold.
  ///
  /// In en, this message translates to:
  /// **'Release this slot'**
  String get cancelHoldAction;

  /// Heading after payment.
  ///
  /// In en, this message translates to:
  /// **'You are booked!'**
  String get bookingConfirmedTitle;

  /// Text after payment.
  ///
  /// In en, this message translates to:
  /// **'Collect it at {drawer} at the time below.'**
  String bookingConfirmedBody(String drawer);

  /// Opens the booking detail.
  ///
  /// In en, this message translates to:
  /// **'View booking'**
  String get viewBookingAction;

  /// Returns to the home screen.
  ///
  /// In en, this message translates to:
  /// **'Back to explore'**
  String get backToExplore;

  /// Heading of the bookings list.
  ///
  /// In en, this message translates to:
  /// **'My bookings'**
  String get myBookingsTitle;

  /// Tab of current and future bookings.
  ///
  /// In en, this message translates to:
  /// **'Upcoming'**
  String get bookingsUpcoming;

  /// Tab of finished bookings.
  ///
  /// In en, this message translates to:
  /// **'Past'**
  String get bookingsPast;

  /// Empty bookings list.
  ///
  /// In en, this message translates to:
  /// **'You have no bookings here yet.'**
  String get bookingsEmpty;

  /// Booking status.
  ///
  /// In en, this message translates to:
  /// **'Awaiting payment'**
  String get statusHeld;

  /// Booking status.
  ///
  /// In en, this message translates to:
  /// **'Confirmed'**
  String get statusConfirmed;

  /// Booking status.
  ///
  /// In en, this message translates to:
  /// **'Out on rental'**
  String get statusActive;

  /// Booking status.
  ///
  /// In en, this message translates to:
  /// **'Overdue'**
  String get statusOverdue;

  /// Booking status.
  ///
  /// In en, this message translates to:
  /// **'Completed'**
  String get statusCompleted;

  /// Booking status.
  ///
  /// In en, this message translates to:
  /// **'Cancelled'**
  String get statusCancelled;

  /// Booking status.
  ///
  /// In en, this message translates to:
  /// **'Expired'**
  String get statusExpired;

  /// Booking status.
  ///
  /// In en, this message translates to:
  /// **'No-show'**
  String get statusNoShow;

  /// Heading of the booking detail.
  ///
  /// In en, this message translates to:
  /// **'Booking'**
  String get bookingDetailTitle;

  /// Label.
  ///
  /// In en, this message translates to:
  /// **'When'**
  String get whenLabel;

  /// Label.
  ///
  /// In en, this message translates to:
  /// **'Where'**
  String get whereLabel;

  /// Label of the reserved unit code.
  ///
  /// In en, this message translates to:
  /// **'Unit'**
  String get unitLabel;

  /// Label.
  ///
  /// In en, this message translates to:
  /// **'Price'**
  String get priceLabel;

  /// Label.
  ///
  /// In en, this message translates to:
  /// **'Payment'**
  String get paymentLabel;

  /// Label.
  ///
  /// In en, this message translates to:
  /// **'Refund'**
  String get refundLabel;

  /// Refund amount and state.
  ///
  /// In en, this message translates to:
  /// **'{amount} ({status})'**
  String refundValue(String amount, String status);

  /// Refund state.
  ///
  /// In en, this message translates to:
  /// **'Processed'**
  String get refundProcessed;

  /// Refund state.
  ///
  /// In en, this message translates to:
  /// **'On its way'**
  String get refundPending;

  /// Refund state.
  ///
  /// In en, this message translates to:
  /// **'Needs attention'**
  String get refundFailed;

  /// Payment state.
  ///
  /// In en, this message translates to:
  /// **'Paid'**
  String get paymentCaptured;

  /// Payment state.
  ///
  /// In en, this message translates to:
  /// **'Not paid yet'**
  String get paymentCreated;

  /// Payment state.
  ///
  /// In en, this message translates to:
  /// **'Refunded'**
  String get paymentRefunded;

  /// No payment.
  ///
  /// In en, this message translates to:
  /// **'Not paid'**
  String get paymentNone;

  /// Continues to pay for a hold.
  ///
  /// In en, this message translates to:
  /// **'Pay now'**
  String get payNowAction;

  /// Starts cancelling.
  ///
  /// In en, this message translates to:
  /// **'Cancel booking'**
  String get cancelBookingAction;

  /// Dialog title.
  ///
  /// In en, this message translates to:
  /// **'Cancel this booking?'**
  String get cancelConfirmTitle;

  /// Dialog text.
  ///
  /// In en, this message translates to:
  /// **'You get a refund according to the cancellation policy: the earlier you cancel, the more you get back.'**
  String get cancelConfirmBody;

  /// Dialog button that does not cancel.
  ///
  /// In en, this message translates to:
  /// **'Keep booking'**
  String get keepBookingAction;

  /// Link from sign-in to the recovery screen.
  ///
  /// In en, this message translates to:
  /// **'Forgot your password?'**
  String get forgotPasswordLink;

  /// Heading of the recovery screen.
  ///
  /// In en, this message translates to:
  /// **'Reset your password'**
  String get forgotTitle;

  /// Explains recovery.
  ///
  /// In en, this message translates to:
  /// **'Enter your email. If an account exists we send you a code to choose a new password.'**
  String get forgotSubtitle;

  /// Sends the recovery mail.
  ///
  /// In en, this message translates to:
  /// **'Send reset email'**
  String get forgotSendAction;

  /// Always shown after sending (never reveals whether the account exists).
  ///
  /// In en, this message translates to:
  /// **'If an account exists for that email, a message is on its way.'**
  String get forgotSent;

  /// Goes to the screen where the emailed code is entered.
  ///
  /// In en, this message translates to:
  /// **'I have a code'**
  String get haveCodeAction;

  /// Heading of the reset screen.
  ///
  /// In en, this message translates to:
  /// **'Choose a new password'**
  String get resetTitle;

  /// Label of the token field.
  ///
  /// In en, this message translates to:
  /// **'Code from the email'**
  String get resetCodeLabel;

  /// Saves the password.
  ///
  /// In en, this message translates to:
  /// **'Save new password'**
  String get resetAction;

  /// Shown after a successful reset.
  ///
  /// In en, this message translates to:
  /// **'Password changed. Sign in with your new password.'**
  String get resetDone;

  /// Shown for a bad or expired reset code.
  ///
  /// In en, this message translates to:
  /// **'That code is not valid any more. Ask for a new email.'**
  String get resetCodeInvalid;

  /// Opens the extension chooser.
  ///
  /// In en, this message translates to:
  /// **'Extend rental'**
  String get extendAction;

  /// Title of the extension sheet.
  ///
  /// In en, this message translates to:
  /// **'Keep it longer'**
  String get extendTitle;

  /// Option to add this much time.
  ///
  /// In en, this message translates to:
  /// **'+{duration}'**
  String extendPlus(String duration);

  /// Price of the extension.
  ///
  /// In en, this message translates to:
  /// **'Extra {amount} for {duration}'**
  String extendPrice(String amount, String duration);

  /// Pays the extension.
  ///
  /// In en, this message translates to:
  /// **'Pay {amount} and extend'**
  String extendPayAction(String amount);

  /// Shown for EXTENSION_UNAVAILABLE.
  ///
  /// In en, this message translates to:
  /// **'Someone has booked this unit after you, so it cannot be extended that long. {hint}'**
  String extendUnavailable(String hint);

  /// Shown after a successful extension.
  ///
  /// In en, this message translates to:
  /// **'Your rental now ends at {time}.'**
  String extendDone(String time);

  /// Heading of the Aadhaar verification screen.
  ///
  /// In en, this message translates to:
  /// **'Verify your identity'**
  String get kycTitle;

  /// Why verification is needed.
  ///
  /// In en, this message translates to:
  /// **'To keep everyone\'s items safe, we need to confirm who you are with your Aadhaar card before your first booking.'**
  String get kycWhy;

  /// Consent and privacy text.
  ///
  /// In en, this message translates to:
  /// **'Your Aadhaar number is sent securely to our verification partner to confirm your identity. We never store the full number — only the last four digits.'**
  String get kycConsent;

  /// Label of the number field.
  ///
  /// In en, this message translates to:
  /// **'Aadhaar number'**
  String get kycNumberLabel;

  /// Hint under the number field.
  ///
  /// In en, this message translates to:
  /// **'12 digits, as printed on the card'**
  String get kycNumberHint;

  /// Sends the one-time code.
  ///
  /// In en, this message translates to:
  /// **'Send code'**
  String get kycSendCode;

  /// After the code was sent.
  ///
  /// In en, this message translates to:
  /// **'We sent a code to the phone linked to {number}.'**
  String kycCodeSent(String number);

  /// Label of the code field.
  ///
  /// In en, this message translates to:
  /// **'One-time code'**
  String get kycCodeLabel;

  /// Verifies the code.
  ///
  /// In en, this message translates to:
  /// **'Verify'**
  String get kycVerifyAction;

  /// Goes back to the number step.
  ///
  /// In en, this message translates to:
  /// **'Use a different number'**
  String get kycChangeNumber;

  /// Shown after successful verification.
  ///
  /// In en, this message translates to:
  /// **'You are verified'**
  String get kycVerifiedTitle;

  /// Shown after successful verification.
  ///
  /// In en, this message translates to:
  /// **'Aadhaar {number} is verified. You can now book.'**
  String kycVerifiedBody(String number);

  /// Leaves the verification screen.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get kycContinue;

  /// Validation message.
  ///
  /// In en, this message translates to:
  /// **'That is not a valid Aadhaar number. Check the 12 digits.'**
  String get kycInvalidNumber;

  /// Shown for AADHAAR_IN_USE.
  ///
  /// In en, this message translates to:
  /// **'This Aadhaar is already verified on another account.'**
  String get kycInUse;

  /// Shown when staff declined it.
  ///
  /// In en, this message translates to:
  /// **'Your verification was declined. Please contact support.'**
  String get kycDeclined;

  /// Shown for RATE_LIMITED.
  ///
  /// In en, this message translates to:
  /// **'Too many attempts. Please try again later.'**
  String get kycTooMany;

  /// Shown for KYC_REQUIRED.
  ///
  /// In en, this message translates to:
  /// **'Verify your identity with your Aadhaar card before booking.'**
  String get kycRequiredError;

  /// Opens the verification screen.
  ///
  /// In en, this message translates to:
  /// **'Verify now'**
  String get kycVerifyNow;

  /// Account tile.
  ///
  /// In en, this message translates to:
  /// **'Not verified'**
  String get kycStatusNone;

  /// Account tile.
  ///
  /// In en, this message translates to:
  /// **'Verification in progress'**
  String get kycStatusPending;

  /// Account tile.
  ///
  /// In en, this message translates to:
  /// **'Identity verified'**
  String get kycStatusVerified;

  /// Account tile.
  ///
  /// In en, this message translates to:
  /// **'Verification declined'**
  String get kycStatusRejected;

  /// Shown for INVALID_STATE on cancel.
  ///
  /// In en, this message translates to:
  /// **'This booking can no longer be cancelled.'**
  String get cancelNotAllowed;

  /// Title of the demo payment sheet.
  ///
  /// In en, this message translates to:
  /// **'Razorpay checkout (demo)'**
  String get demoCheckoutTitle;

  /// Explains the demo payment sheet.
  ///
  /// In en, this message translates to:
  /// **'No real money moves. Pick a test payment method to see how the booking reacts.'**
  String get demoCheckoutNote;

  /// Demo payment method that succeeds.
  ///
  /// In en, this message translates to:
  /// **'Test card 4111 1111 1111 1111 (succeeds)'**
  String get demoMethodCardOk;

  /// Demo payment method that succeeds.
  ///
  /// In en, this message translates to:
  /// **'UPI success@razorpay (succeeds)'**
  String get demoMethodUpi;

  /// Demo payment method that fails.
  ///
  /// In en, this message translates to:
  /// **'Test card 4000 0000 0000 0002 (is declined)'**
  String get demoMethodCardFail;

  /// Shown after the demo gateway declines.
  ///
  /// In en, this message translates to:
  /// **'The payment was declined. Your slot is still held, so you can try again.'**
  String get demoPaymentFailed;

  /// Account tile shown while the email is not verified.
  ///
  /// In en, this message translates to:
  /// **'Verify your email'**
  String get emailVerifyTile;

  /// Account tile shown once the email is verified.
  ///
  /// In en, this message translates to:
  /// **'Email verified'**
  String get emailVerifiedTile;

  /// Title of the email verification screen.
  ///
  /// In en, this message translates to:
  /// **'Verify your email'**
  String get emailVerifyTitle;

  /// Explains how to verify.
  ///
  /// In en, this message translates to:
  /// **'We sent a link to {email}. Open it, or paste the code from the link below.'**
  String emailVerifyBody(String email);

  /// Field label.
  ///
  /// In en, this message translates to:
  /// **'Code from the link'**
  String get emailVerifyCode;

  /// Button.
  ///
  /// In en, this message translates to:
  /// **'Verify email'**
  String get emailVerifyAction;

  /// Button.
  ///
  /// In en, this message translates to:
  /// **'Send a new link'**
  String get emailVerifyResend;

  /// Confirmation after asking for a new link.
  ///
  /// In en, this message translates to:
  /// **'If a new link was due, it is on its way.'**
  String get emailVerifyResent;

  /// Success message.
  ///
  /// In en, this message translates to:
  /// **'Your email is verified.'**
  String get emailVerifyDone;

  /// The code was refused.
  ///
  /// In en, this message translates to:
  /// **'That code is not valid or has expired. Ask for a new link.'**
  String get emailVerifyInvalid;

  /// Greeting at the top of the explore screen.
  ///
  /// In en, this message translates to:
  /// **'Hi, {name}'**
  String exploreGreeting(String name);

  /// Line under the greeting.
  ///
  /// In en, this message translates to:
  /// **'Rent what you need, by the hour.'**
  String get exploreTagline;

  /// Heading above the nearby drawers.
  ///
  /// In en, this message translates to:
  /// **'Open near you'**
  String get nearbyHeading;

  /// Number of free units of a product.
  ///
  /// In en, this message translates to:
  /// **'{count} free'**
  String freeUnits(int count);

  /// Shown on a product card when no unit is free.
  ///
  /// In en, this message translates to:
  /// **'None free now'**
  String get soldOutNow;

  /// Accessible label of a gallery page.
  ///
  /// In en, this message translates to:
  /// **'Photo {index} of {total}'**
  String galleryCount(int index, int total);

  /// Label above the total in the sticky reserve bar.
  ///
  /// In en, this message translates to:
  /// **'Total to pay'**
  String get totalToPay;

  /// Hint in the reserve bar before a slot is chosen.
  ///
  /// In en, this message translates to:
  /// **'Pick a time and length'**
  String get pickATimeFirst;

  /// Empty state title on the Upcoming tab.
  ///
  /// In en, this message translates to:
  /// **'No upcoming bookings'**
  String get bookingsEmptyUpcoming;

  /// Empty state text.
  ///
  /// In en, this message translates to:
  /// **'Find a drawer near you and reserve something.'**
  String get bookingsEmptyUpcomingBody;

  /// Empty state title on the Past tab.
  ///
  /// In en, this message translates to:
  /// **'Nothing here yet'**
  String get bookingsEmptyPast;

  /// Hint under the identity tile.
  ///
  /// In en, this message translates to:
  /// **'Verified accounts can book right away.'**
  String get accountVerifiedHint;

  /// Kept for the brand header of the sign-in screen.
  ///
  /// In en, this message translates to:
  /// **'Welcome back'**
  String get welcomeBack;

  /// Account tile that starts account deletion.
  ///
  /// In en, this message translates to:
  /// **'Delete my account'**
  String get deleteAccountTile;

  /// Title of the confirmation dialog.
  ///
  /// In en, this message translates to:
  /// **'Delete your account?'**
  String get deleteAccountTitle;

  /// Explains what deletion does.
  ///
  /// In en, this message translates to:
  /// **'This removes your details and signs you out everywhere. Your booking history stays, without your name. This cannot be undone.'**
  String get deleteAccountBody;

  /// Field label: password to confirm deletion.
  ///
  /// In en, this message translates to:
  /// **'Your password'**
  String get deleteAccountPassword;

  /// Destructive confirm button.
  ///
  /// In en, this message translates to:
  /// **'Delete account'**
  String get deleteAccountConfirm;

  /// Shown when the password is refused.
  ///
  /// In en, this message translates to:
  /// **'That password is not right.'**
  String get deleteAccountWrongPassword;

  /// Shown when a live booking blocks deletion.
  ///
  /// In en, this message translates to:
  /// **'Cancel or finish your current bookings first, then delete your account.'**
  String get deleteAccountBlocked;

  /// Account tile that opens the profile editor.
  ///
  /// In en, this message translates to:
  /// **'Edit profile'**
  String get editProfileTile;

  /// Title of the profile editor.
  ///
  /// In en, this message translates to:
  /// **'Your details'**
  String get editProfileTitle;

  /// Field label: display name.
  ///
  /// In en, this message translates to:
  /// **'Name'**
  String get editProfileName;

  /// Field label: phone number.
  ///
  /// In en, this message translates to:
  /// **'Mobile number'**
  String get editProfilePhone;

  /// Hint under the phone field.
  ///
  /// In en, this message translates to:
  /// **'With country code, e.g. +919876543210'**
  String get editProfilePhoneHint;

  /// Save button of the profile editor.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get editProfileSave;

  /// Snackbar after saving.
  ///
  /// In en, this message translates to:
  /// **'Details saved'**
  String get editProfileSaved;

  /// Shown when the server rejects the details.
  ///
  /// In en, this message translates to:
  /// **'Check the name (1–100 characters) and the number (+ and 7–15 digits).'**
  String get editProfileInvalid;

  /// Booking screen: heading before pickup.
  ///
  /// In en, this message translates to:
  /// **'Collect your item'**
  String get guidanceConfirmedTitle;

  /// Booking screen: before the start.
  ///
  /// In en, this message translates to:
  /// **'Starts in {when}. Go to {drawer} when your time begins and show this booking to the staff.'**
  String guidanceConfirmedBefore(String when, String drawer);

  /// Booking screen: the start time has passed, not yet handed over.
  ///
  /// In en, this message translates to:
  /// **'Your time has started. Go to {drawer} and show this booking to the staff.'**
  String guidanceConfirmedNow(String drawer);

  /// Booking screen: heading while the item is with the customer.
  ///
  /// In en, this message translates to:
  /// **'In use'**
  String get guidanceActiveTitle;

  /// Booking screen: how to return.
  ///
  /// In en, this message translates to:
  /// **'Return it to {drawer} by {time}. Time left: {left}.'**
  String guidanceActiveBody(String drawer, String time, String left);

  /// Booking screen: the rental is nearly over.
  ///
  /// In en, this message translates to:
  /// **'Almost time: return it to {drawer} by {time}, or extend your booking.'**
  String guidanceActiveSoon(String drawer, String time);

  /// Booking screen: heading when overdue.
  ///
  /// In en, this message translates to:
  /// **'Please return it now'**
  String get guidanceOverdueTitle;

  /// Booking screen: overdue instruction.
  ///
  /// In en, this message translates to:
  /// **'Your time ended at {time}. Return it to {drawer} as soon as you can.'**
  String guidanceOverdueBody(String time, String drawer);

  /// Booking screen: heading after the return.
  ///
  /// In en, this message translates to:
  /// **'Returned'**
  String get guidanceCompletedTitle;

  /// Booking screen: closing line.
  ///
  /// In en, this message translates to:
  /// **'Thanks for renting with Rento.'**
  String get guidanceCompletedBody;

  /// Booking screen: heading for a no-show.
  ///
  /// In en, this message translates to:
  /// **'Not collected'**
  String get guidanceNoShowTitle;

  /// Booking screen: no-show explanation.
  ///
  /// In en, this message translates to:
  /// **'This booking was not collected during your time.'**
  String get guidanceNoShowBody;

  /// Banner shown while Rento cannot be reached.
  ///
  /// In en, this message translates to:
  /// **'You are offline. Showing what was saved. Booking and payments need a connection.'**
  String get offlineBanner;

  /// Button on the offline banner.
  ///
  /// In en, this message translates to:
  /// **'Check again'**
  String get offlineCheckAgain;

  /// Shown next to a disabled action while offline.
  ///
  /// In en, this message translates to:
  /// **'Connect to the internet to do this.'**
  String get offlineActionHint;

  /// Trust chip: the email is verified.
  ///
  /// In en, this message translates to:
  /// **'Email verified'**
  String get trustEmailOk;

  /// Trust chip: the email is not verified yet.
  ///
  /// In en, this message translates to:
  /// **'Email not verified'**
  String get trustEmailNo;

  /// Trust chip: Aadhaar verification done.
  ///
  /// In en, this message translates to:
  /// **'ID verified'**
  String get trustIdOk;

  /// Trust chip: identity check pending.
  ///
  /// In en, this message translates to:
  /// **'ID in review'**
  String get trustIdPending;

  /// Trust chip: identity not verified yet.
  ///
  /// In en, this message translates to:
  /// **'ID not verified'**
  String get trustIdNo;

  /// Trust chip: identity check was refused.
  ///
  /// In en, this message translates to:
  /// **'ID not accepted'**
  String get trustIdRejected;

  /// Spoken label of the verified tick.
  ///
  /// In en, this message translates to:
  /// **'Verified'**
  String get verifiedBadgeLabel;

  /// Heading above the verification chips.
  ///
  /// In en, this message translates to:
  /// **'Your trust level'**
  String get trustHeading;

  /// Account: opens the photo choices.
  ///
  /// In en, this message translates to:
  /// **'Change photo'**
  String get photoChange;

  /// Photo choice: use the camera.
  ///
  /// In en, this message translates to:
  /// **'Take a photo'**
  String get photoTake;

  /// Photo choice: pick a picture on the phone.
  ///
  /// In en, this message translates to:
  /// **'Choose from gallery'**
  String get photoChoose;

  /// Photo choice: go back to the initial letter.
  ///
  /// In en, this message translates to:
  /// **'Remove photo'**
  String get photoRemove;

  /// Snackbar after a new photo was saved.
  ///
  /// In en, this message translates to:
  /// **'Photo updated'**
  String get photoSaved;

  /// Snackbar after the photo was removed.
  ///
  /// In en, this message translates to:
  /// **'Photo removed'**
  String get photoRemoved;

  /// Shown when the server refuses the photo.
  ///
  /// In en, this message translates to:
  /// **'The photo could not be saved. Use a JPEG, PNG or WebP picture under 2 MB.'**
  String get photoFailed;

  /// Account: opens the list of ways to sign in.
  ///
  /// In en, this message translates to:
  /// **'Sign-in methods'**
  String get signInMethodsTile;

  /// Title of the sign-in methods screen.
  ///
  /// In en, this message translates to:
  /// **'Sign-in methods'**
  String get signInMethodsTitle;

  /// Explains the sign-in methods screen.
  ///
  /// In en, this message translates to:
  /// **'These are the ways you can sign in to Rento. You always keep at least one.'**
  String get signInMethodsIntro;

  /// Name of the password sign-in method.
  ///
  /// In en, this message translates to:
  /// **'Email and password'**
  String get methodPassword;

  /// Name of the Google sign-in method.
  ///
  /// In en, this message translates to:
  /// **'Google'**
  String get methodGoogle;

  /// Name of the Facebook sign-in method.
  ///
  /// In en, this message translates to:
  /// **'Facebook'**
  String get methodFacebook;

  /// Name of the Apple sign-in method.
  ///
  /// In en, this message translates to:
  /// **'Apple'**
  String get methodApple;

  /// Subtitle of a sign-in method: when it was added.
  ///
  /// In en, this message translates to:
  /// **'Added {date}'**
  String methodLinkedOn(String date);

  /// Button: remove a sign-in method.
  ///
  /// In en, this message translates to:
  /// **'Remove'**
  String get methodRemove;

  /// Shown instead of Remove when it is the last method.
  ///
  /// In en, this message translates to:
  /// **'Your only way to sign in'**
  String get methodOnlyOne;

  /// Dialog title when removing a sign-in method.
  ///
  /// In en, this message translates to:
  /// **'Remove this way to sign in?'**
  String get methodRemoveTitle;

  /// Dialog body when removing a sign-in method.
  ///
  /// In en, this message translates to:
  /// **'You will no longer be able to sign in with {method}. Your bookings and details stay as they are.'**
  String methodRemoveBody(String method);

  /// Snackbar after a sign-in method was removed.
  ///
  /// In en, this message translates to:
  /// **'Removed'**
  String get methodRemoved;

  /// Error: last sign-in method.
  ///
  /// In en, this message translates to:
  /// **'You need at least one way to sign in, so this one cannot be removed.'**
  String get methodLastError;

  /// Heading above the products that can be rented from the nearest drawers.
  ///
  /// In en, this message translates to:
  /// **'Rent near you'**
  String get rentNearYou;

  /// Heading above the list of nearby drawers.
  ///
  /// In en, this message translates to:
  /// **'Drawers near you'**
  String get drawersNearYou;

  /// Under a product card: the drawer it is picked up from.
  ///
  /// In en, this message translates to:
  /// **'at {drawer}'**
  String fromDrawer(String drawer);

  /// Shown while the phone's position is being found.
  ///
  /// In en, this message translates to:
  /// **'Finding the drawers nearest to you…'**
  String get locatingNearest;

  /// Banner when the position is unknown and all drawers are shown.
  ///
  /// In en, this message translates to:
  /// **'Turn on location to see what is nearest. Showing every drawer for now.'**
  String get locationOffNote;

  /// Banner when no drawer serves the chosen place and all drawers are shown.
  ///
  /// In en, this message translates to:
  /// **'Nothing near you yet. Here is everything Rento has.'**
  String get nothingNearNote;

  /// Heading above the list of every drawer.
  ///
  /// In en, this message translates to:
  /// **'All drawers'**
  String get allDrawersHeading;

  /// Heading above products when every drawer is shown.
  ///
  /// In en, this message translates to:
  /// **'Popular to rent'**
  String get rentFromDrawers;

  /// Shown when someone tries to order from a drawer that does not serve where they are.
  ///
  /// In en, this message translates to:
  /// **'Sorry, this drawer is not available in your area. Try a drawer nearer to you.'**
  String get notInYourArea;

  /// Shown when ordering needs the position and it could not be found.
  ///
  /// In en, this message translates to:
  /// **'Allow location access so we can check Rento is available in your area, then try again.'**
  String get locationNeededToOrder;

  /// Badge on a product that can be rented now in the customer's area.
  ///
  /// In en, this message translates to:
  /// **'Available'**
  String get availableLabel;

  /// Heading of the products that have an active discount.
  ///
  /// In en, this message translates to:
  /// **'Offers for you'**
  String get offersForYou;

  /// Heading of the products added in the last two weeks.
  ///
  /// In en, this message translates to:
  /// **'New arrivals'**
  String get newArrivals;

  /// Heading of the products staff chose to feature.
  ///
  /// In en, this message translates to:
  /// **'Featured'**
  String get featuredHeading;

  /// Heading of the complete product grid.
  ///
  /// In en, this message translates to:
  /// **'All products'**
  String get allProducts;

  /// Badge on a product with an offer: the percent off.
  ///
  /// In en, this message translates to:
  /// **'-{percent}%'**
  String discountBadge(int percent);

  /// Badge on a product added recently.
  ///
  /// In en, this message translates to:
  /// **'NEW'**
  String get newBadge;

  /// Under a price: how long one slot is.
  ///
  /// In en, this message translates to:
  /// **'per {minutes} min'**
  String perSlotShort(int minutes);

  /// Spoken label of the struck-out normal price.
  ///
  /// In en, this message translates to:
  /// **'was {price}'**
  String wasPrice(String price);

  /// Under the price of a product whose offer has an end.
  ///
  /// In en, this message translates to:
  /// **'Offer ends {when}'**
  String offerEndsOn(String when);

  /// Price summary line: the saving from the offer.
  ///
  /// In en, this message translates to:
  /// **'Offer -{percent}%'**
  String summaryOffer(int percent);

  /// Price summary line when only the amount saved is known.
  ///
  /// In en, this message translates to:
  /// **'Offer saving'**
  String get summaryOfferNoPercent;

  /// Line showing what an offer saved the customer.
  ///
  /// In en, this message translates to:
  /// **'You save {amount}'**
  String youSave(String amount);

  /// Shown when a banner's product cannot be opened.
  ///
  /// In en, this message translates to:
  /// **'That item is not available near you right now.'**
  String get promoNotAvailable;

  /// Spoken label of a banner in the carousel.
  ///
  /// In en, this message translates to:
  /// **'Offer {index} of {total}'**
  String bannerCountLabel(int index, int total);
}

class _AppLocalizationsDelegate extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) => <String>['en'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {


  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en': return AppLocalizationsEn();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.'
  );
}
