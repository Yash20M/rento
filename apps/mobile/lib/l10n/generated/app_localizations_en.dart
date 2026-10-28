// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appName => 'Rento';

  @override
  String get notFoundTitle => 'Page not found';

  @override
  String get notFoundAction => 'Back to home';

  @override
  String envFlavorLabel(String flavor) {
    return 'Environment: $flavor';
  }

  @override
  String get envErrorTitle => 'Rento cannot start';

  @override
  String get actionRetry => 'Try again';

  @override
  String get actionCancel => 'Cancel';

  @override
  String get actionClose => 'Close';

  @override
  String get errorNetwork => 'Cannot reach Rento. Check your connection and try again.';

  @override
  String get errorGeneric => 'Something went wrong. Please try again.';

  @override
  String get errorBusy => 'Rento is busy right now. Please try again in a moment.';

  @override
  String get errorLoading => 'We could not load this.';

  @override
  String get fieldRequired => 'Required';

  @override
  String get loginTitle => 'Welcome back';

  @override
  String get loginSubtitle => 'Sign in to book and manage your rentals.';

  @override
  String get registerTitle => 'Create your account';

  @override
  String get registerSubtitle => 'It takes a minute. You can rent right after.';

  @override
  String get emailLabel => 'Email';

  @override
  String get passwordLabel => 'Password';

  @override
  String get passwordHint => 'At least 10 characters';

  @override
  String get nameLabel => 'Your name';

  @override
  String get signInAction => 'Sign in';

  @override
  String get registerAction => 'Create account';

  @override
  String get goToRegister => 'New to Rento? Create an account';

  @override
  String get goToLogin => 'Already have an account? Sign in';

  @override
  String get loginFailed => 'Incorrect email or password.';

  @override
  String get emailTakenError => 'An account with this email already exists. Try signing in.';

  @override
  String get signOutAction => 'Sign out';

  @override
  String get tabExplore => 'Explore';

  @override
  String get tabBookings => 'My bookings';

  @override
  String get tabAccount => 'Account';

  @override
  String get accountTitle => 'Account';

  @override
  String signedInAs(String email) {
    return 'Signed in as $email';
  }

  @override
  String get unknownUser => 'your account';

  @override
  String get exploreTitle => 'Find a drawer';

  @override
  String searchingNear(String place) {
    return 'Near $place';
  }

  @override
  String get placeMyLocation => 'your location';

  @override
  String get changeLocation => 'Change';

  @override
  String get chooseLocationTitle => 'Where are you?';

  @override
  String get useMyLocation => 'Use my location';

  @override
  String get demoLocationsHeading => 'Demo locations';

  @override
  String get enterCoordinates => 'Or enter coordinates';

  @override
  String get latitudeLabel => 'Latitude';

  @override
  String get longitudeLabel => 'Longitude';

  @override
  String get searchHere => 'Search here';

  @override
  String get coordinatesInvalid => 'Latitude is −90 to 90 and longitude −180 to 180.';

  @override
  String get locationServicesOff => 'Location services are turned off on this device.';

  @override
  String get locationDenied => 'Location permission was not granted. You can choose a place instead.';

  @override
  String get locationDeniedForever => 'Location permission is blocked. Enable it in settings or choose a place instead.';

  @override
  String get locationUnavailable => 'We could not find your position. Choose a place instead.';

  @override
  String get nearbyEmpty => 'No drawers are open near here right now.';

  @override
  String get outsideServiceArea => 'Rento is not available near this location yet.';

  @override
  String get drawerOpenNow => 'Open now';

  @override
  String get drawerClosedNow => 'Closed now';

  @override
  String distanceAway(String distance) {
    return '$distance away';
  }

  @override
  String get unavailableHeading => 'Nearby, but not available right now';

  @override
  String get reasonClosed => 'Closed';

  @override
  String get reasonOutOfStock => 'Out of stock';

  @override
  String get drawerHeading => 'Drawer';

  @override
  String get itemsHeading => 'What you can rent here';

  @override
  String get itemsEmpty => 'Nothing to rent here yet.';

  @override
  String availableNowCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count available now',
      one: '1 available now',
      zero: 'None free right now',
    );
    return '$_temp0';
  }

  @override
  String pricePerSlot(String price, int minutes) {
    return '$price per $minutes min';
  }

  @override
  String get pickupInstructions => 'Pickup instructions';

  @override
  String get hoursHeading => 'Opening hours';

  @override
  String get hoursClosedDay => 'Closed';

  @override
  String get weekdayShort1 => 'Mon';

  @override
  String get weekdayShort2 => 'Tue';

  @override
  String get weekdayShort3 => 'Wed';

  @override
  String get weekdayShort4 => 'Thu';

  @override
  String get weekdayShort5 => 'Fri';

  @override
  String get weekdayShort6 => 'Sat';

  @override
  String get weekdayShort7 => 'Sun';

  @override
  String get chooseDay => 'Choose a day';

  @override
  String get chooseStart => 'Choose a start time';

  @override
  String get chooseDuration => 'How long?';

  @override
  String timesInZone(String zone) {
    return 'Times are in $zone';
  }

  @override
  String get noSlots => 'No times are available on this day.';

  @override
  String get closedThisDay => 'The drawer is closed on this day.';

  @override
  String durationLabel(String duration) {
    return '$duration';
  }

  @override
  String durationHours(int hours) {
    return '$hours h';
  }

  @override
  String durationMinutes(int minutes) {
    return '$minutes min';
  }

  @override
  String durationHoursMinutes(int hours, int minutes) {
    return '$hours h $minutes min';
  }

  @override
  String get summaryRental => 'Rental';

  @override
  String get summaryDeposit => 'Deposit (returned when you bring it back)';

  @override
  String get summaryTotal => 'Total';

  @override
  String get reserveAction => 'Reserve & pay';

  @override
  String get slotTakenError => 'Someone just took that time. Please pick another.';

  @override
  String get leadTimeError => 'That start is too soon or too far ahead. Please pick another time.';

  @override
  String get drawerClosedError => 'The drawer is closed at that time. Please pick another.';

  @override
  String get durationInvalidError => 'That length is not available. Please pick another.';

  @override
  String get snapshotNote => 'Availability can change while you decide; we check again when you reserve.';

  @override
  String get checkoutTitle => 'Complete your booking';

  @override
  String holdCountdown(String time) {
    return 'We are holding this for you for $time';
  }

  @override
  String get holdExpiredTitle => 'Time ran out';

  @override
  String get holdExpiredBody => 'The slot was released. Please choose a time again.';

  @override
  String payAction(String amount) {
    return 'Pay $amount';
  }

  @override
  String get demoPaymentNote => 'Demo payment: no money is charged.';

  @override
  String get paymentFailed => 'The payment could not be confirmed. You were not charged. Please try again.';

  @override
  String get cancelHoldAction => 'Release this slot';

  @override
  String get bookingConfirmedTitle => 'You are booked!';

  @override
  String bookingConfirmedBody(String drawer) {
    return 'Collect it at $drawer at the time below.';
  }

  @override
  String get viewBookingAction => 'View booking';

  @override
  String get backToExplore => 'Back to explore';

  @override
  String get myBookingsTitle => 'My bookings';

  @override
  String get bookingsUpcoming => 'Upcoming';

  @override
  String get bookingsPast => 'Past';

  @override
  String get bookingsEmpty => 'You have no bookings here yet.';

  @override
  String get statusHeld => 'Awaiting payment';

  @override
  String get statusConfirmed => 'Confirmed';

  @override
  String get statusActive => 'Out on rental';

  @override
  String get statusOverdue => 'Overdue';

  @override
  String get statusCompleted => 'Completed';

  @override
  String get statusCancelled => 'Cancelled';

  @override
  String get statusExpired => 'Expired';

  @override
  String get statusNoShow => 'No-show';

  @override
  String get bookingDetailTitle => 'Booking';

  @override
  String get whenLabel => 'When';

  @override
  String get whereLabel => 'Where';

  @override
  String get unitLabel => 'Unit';

  @override
  String get priceLabel => 'Price';

  @override
  String get paymentLabel => 'Payment';

  @override
  String get refundLabel => 'Refund';

  @override
  String refundValue(String amount, String status) {
    return '$amount ($status)';
  }

  @override
  String get refundProcessed => 'Processed';

  @override
  String get refundPending => 'On its way';

  @override
  String get refundFailed => 'Needs attention';

  @override
  String get paymentCaptured => 'Paid';

  @override
  String get paymentCreated => 'Not paid yet';

  @override
  String get paymentRefunded => 'Refunded';

  @override
  String get paymentNone => 'Not paid';

  @override
  String get payNowAction => 'Pay now';

  @override
  String get cancelBookingAction => 'Cancel booking';

  @override
  String get cancelConfirmTitle => 'Cancel this booking?';

  @override
  String get cancelConfirmBody => 'You get a refund according to the cancellation policy: the earlier you cancel, the more you get back.';

  @override
  String get keepBookingAction => 'Keep booking';

  @override
  String get forgotPasswordLink => 'Forgot your password?';

  @override
  String get forgotTitle => 'Reset your password';

  @override
  String get forgotSubtitle => 'Enter your email. If an account exists we send you a code to choose a new password.';

  @override
  String get forgotSendAction => 'Send reset email';

  @override
  String get forgotSent => 'If an account exists for that email, a message is on its way.';

  @override
  String get haveCodeAction => 'I have a code';

  @override
  String get resetTitle => 'Choose a new password';

  @override
  String get resetCodeLabel => 'Code from the email';

  @override
  String get resetAction => 'Save new password';

  @override
  String get resetDone => 'Password changed. Sign in with your new password.';

  @override
  String get resetCodeInvalid => 'That code is not valid any more. Ask for a new email.';

  @override
  String get extendAction => 'Extend rental';

  @override
  String get extendTitle => 'Keep it longer';

  @override
  String extendPlus(String duration) {
    return '+$duration';
  }

  @override
  String extendPrice(String amount, String duration) {
    return 'Extra $amount for $duration';
  }

  @override
  String extendPayAction(String amount) {
    return 'Pay $amount and extend';
  }

  @override
  String extendUnavailable(String hint) {
    return 'Someone has booked this unit after you, so it cannot be extended that long. $hint';
  }

  @override
  String extendDone(String time) {
    return 'Your rental now ends at $time.';
  }

  @override
  String get kycTitle => 'Verify your identity';

  @override
  String get kycWhy => 'To keep everyone\'s items safe, we need to confirm who you are with your Aadhaar card before your first booking.';

  @override
  String get kycConsent => 'Your Aadhaar number is sent securely to our verification partner to confirm your identity. We never store the full number — only the last four digits.';

  @override
  String get kycNumberLabel => 'Aadhaar number';

  @override
  String get kycNumberHint => '12 digits, as printed on the card';

  @override
  String get kycSendCode => 'Send code';

  @override
  String kycCodeSent(String number) {
    return 'We sent a code to the phone linked to $number.';
  }

  @override
  String get kycCodeLabel => 'One-time code';

  @override
  String get kycVerifyAction => 'Verify';

  @override
  String get kycChangeNumber => 'Use a different number';

  @override
  String get kycVerifiedTitle => 'You are verified';

  @override
  String kycVerifiedBody(String number) {
    return 'Aadhaar $number is verified. You can now book.';
  }

  @override
  String get kycContinue => 'Continue';

  @override
  String get kycInvalidNumber => 'That is not a valid Aadhaar number. Check the 12 digits.';

  @override
  String get kycInUse => 'This Aadhaar is already verified on another account.';

  @override
  String get kycDeclined => 'Your verification was declined. Please contact support.';

  @override
  String get kycTooMany => 'Too many attempts. Please try again later.';

  @override
  String get kycRequiredError => 'Verify your identity with your Aadhaar card before booking.';

  @override
  String get kycVerifyNow => 'Verify now';

  @override
  String get kycStatusNone => 'Not verified';

  @override
  String get kycStatusPending => 'Verification in progress';

  @override
  String get kycStatusVerified => 'Identity verified';

  @override
  String get kycStatusRejected => 'Verification declined';

  @override
  String get cancelNotAllowed => 'This booking can no longer be cancelled.';

  @override
  String get demoCheckoutTitle => 'Razorpay checkout (demo)';

  @override
  String get demoCheckoutNote => 'No real money moves. Pick a test payment method to see how the booking reacts.';

  @override
  String get demoMethodCardOk => 'Test card 4111 1111 1111 1111 (succeeds)';

  @override
  String get demoMethodUpi => 'UPI success@razorpay (succeeds)';

  @override
  String get demoMethodCardFail => 'Test card 4000 0000 0000 0002 (is declined)';

  @override
  String get demoPaymentFailed => 'The payment was declined. Your slot is still held, so you can try again.';

  @override
  String get emailVerifyTile => 'Verify your email';

  @override
  String get emailVerifiedTile => 'Email verified';

  @override
  String get emailVerifyTitle => 'Verify your email';

  @override
  String emailVerifyBody(String email) {
    return 'We sent a link to $email. Open it, or paste the code from the link below.';
  }

  @override
  String get emailVerifyCode => 'Code from the link';

  @override
  String get emailVerifyAction => 'Verify email';

  @override
  String get emailVerifyResend => 'Send a new link';

  @override
  String get emailVerifyResent => 'If a new link was due, it is on its way.';

  @override
  String get emailVerifyDone => 'Your email is verified.';

  @override
  String get emailVerifyInvalid => 'That code is not valid or has expired. Ask for a new link.';

  @override
  String exploreGreeting(String name) {
    return 'Hi, $name';
  }

  @override
  String get exploreTagline => 'Rent what you need, by the hour.';

  @override
  String get nearbyHeading => 'Open near you';

  @override
  String freeUnits(int count) {
    return '$count free';
  }

  @override
  String get soldOutNow => 'None free now';

  @override
  String galleryCount(int index, int total) {
    return 'Photo $index of $total';
  }

  @override
  String get totalToPay => 'Total to pay';

  @override
  String get pickATimeFirst => 'Pick a time and length';

  @override
  String get bookingsEmptyUpcoming => 'No upcoming bookings';

  @override
  String get bookingsEmptyUpcomingBody => 'Find a drawer near you and reserve something.';

  @override
  String get bookingsEmptyPast => 'Nothing here yet';

  @override
  String get accountVerifiedHint => 'Verified accounts can book right away.';

  @override
  String get welcomeBack => 'Welcome back';

  @override
  String get deleteAccountTile => 'Delete my account';

  @override
  String get deleteAccountTitle => 'Delete your account?';

  @override
  String get deleteAccountBody => 'This removes your details and signs you out everywhere. Your booking history stays, without your name. This cannot be undone.';

  @override
  String get deleteAccountPassword => 'Your password';

  @override
  String get deleteAccountConfirm => 'Delete account';

  @override
  String get deleteAccountWrongPassword => 'That password is not right.';

  @override
  String get deleteAccountBlocked => 'Cancel or finish your current bookings first, then delete your account.';

  @override
  String get editProfileTile => 'Edit profile';

  @override
  String get editProfileTitle => 'Your details';

  @override
  String get editProfileName => 'Name';

  @override
  String get editProfilePhone => 'Mobile number';

  @override
  String get editProfilePhoneHint => 'With country code, e.g. +919876543210';

  @override
  String get editProfileSave => 'Save';

  @override
  String get editProfileSaved => 'Details saved';

  @override
  String get editProfileInvalid => 'Check the name (1–100 characters) and the number (+ and 7–15 digits).';

  @override
  String get guidanceConfirmedTitle => 'Collect your item';

  @override
  String guidanceConfirmedBefore(String when, String drawer) {
    return 'Starts in $when. Go to $drawer when your time begins and show this booking to the staff.';
  }

  @override
  String guidanceConfirmedNow(String drawer) {
    return 'Your time has started. Go to $drawer and show this booking to the staff.';
  }

  @override
  String get guidanceActiveTitle => 'In use';

  @override
  String guidanceActiveBody(String drawer, String time, String left) {
    return 'Return it to $drawer by $time. Time left: $left.';
  }

  @override
  String guidanceActiveSoon(String drawer, String time) {
    return 'Almost time: return it to $drawer by $time, or extend your booking.';
  }

  @override
  String get guidanceOverdueTitle => 'Please return it now';

  @override
  String guidanceOverdueBody(String time, String drawer) {
    return 'Your time ended at $time. Return it to $drawer as soon as you can.';
  }

  @override
  String get guidanceCompletedTitle => 'Returned';

  @override
  String get guidanceCompletedBody => 'Thanks for renting with Rento.';

  @override
  String get guidanceNoShowTitle => 'Not collected';

  @override
  String get guidanceNoShowBody => 'This booking was not collected during your time.';

  @override
  String get offlineBanner => 'You are offline. Showing what was saved. Booking and payments need a connection.';

  @override
  String get offlineCheckAgain => 'Check again';

  @override
  String get offlineActionHint => 'Connect to the internet to do this.';

  @override
  String get trustEmailOk => 'Email verified';

  @override
  String get trustEmailNo => 'Email not verified';

  @override
  String get trustIdOk => 'ID verified';

  @override
  String get trustIdPending => 'ID in review';

  @override
  String get trustIdNo => 'ID not verified';

  @override
  String get trustIdRejected => 'ID not accepted';

  @override
  String get verifiedBadgeLabel => 'Verified';

  @override
  String get trustHeading => 'Your trust level';

  @override
  String get photoChange => 'Change photo';

  @override
  String get photoTake => 'Take a photo';

  @override
  String get photoChoose => 'Choose from gallery';

  @override
  String get photoRemove => 'Remove photo';

  @override
  String get photoSaved => 'Photo updated';

  @override
  String get photoRemoved => 'Photo removed';

  @override
  String get photoFailed => 'The photo could not be saved. Use a JPEG, PNG or WebP picture under 2 MB.';

  @override
  String get signInMethodsTile => 'Sign-in methods';

  @override
  String get signInMethodsTitle => 'Sign-in methods';

  @override
  String get signInMethodsIntro => 'These are the ways you can sign in to Rento. You always keep at least one.';

  @override
  String get methodPassword => 'Email and password';

  @override
  String get methodGoogle => 'Google';

  @override
  String get methodFacebook => 'Facebook';

  @override
  String get methodApple => 'Apple';

  @override
  String methodLinkedOn(String date) {
    return 'Added $date';
  }

  @override
  String get methodRemove => 'Remove';

  @override
  String get methodOnlyOne => 'Your only way to sign in';

  @override
  String get methodRemoveTitle => 'Remove this way to sign in?';

  @override
  String methodRemoveBody(String method) {
    return 'You will no longer be able to sign in with $method. Your bookings and details stay as they are.';
  }

  @override
  String get methodRemoved => 'Removed';

  @override
  String get methodLastError => 'You need at least one way to sign in, so this one cannot be removed.';

  @override
  String get rentNearYou => 'Rent near you';

  @override
  String get drawersNearYou => 'Drawers near you';

  @override
  String fromDrawer(String drawer) {
    return 'at $drawer';
  }

  @override
  String get locatingNearest => 'Finding the drawers nearest to you…';

  @override
  String get locationOffNote => 'Turn on location to see what is nearest. Showing every drawer for now.';

  @override
  String get nothingNearNote => 'Nothing near you yet. Here is everything Rento has.';

  @override
  String get allDrawersHeading => 'All drawers';

  @override
  String get rentFromDrawers => 'Popular to rent';

  @override
  String get notInYourArea => 'Sorry, this drawer is not available in your area. Try a drawer nearer to you.';

  @override
  String get locationNeededToOrder => 'Allow location access so we can check Rento is available in your area, then try again.';

  @override
  String get availableLabel => 'Available';

  @override
  String get offersForYou => 'Offers for you';

  @override
  String get newArrivals => 'New arrivals';

  @override
  String get featuredHeading => 'Featured';

  @override
  String get allProducts => 'All products';

  @override
  String discountBadge(int percent) {
    return '-$percent%';
  }

  @override
  String get newBadge => 'NEW';

  @override
  String perSlotShort(int minutes) {
    return 'per $minutes min';
  }

  @override
  String wasPrice(String price) {
    return 'was $price';
  }

  @override
  String offerEndsOn(String when) {
    return 'Offer ends $when';
  }

  @override
  String summaryOffer(int percent) {
    return 'Offer -$percent%';
  }

  @override
  String get summaryOfferNoPercent => 'Offer saving';

  @override
  String youSave(String amount) {
    return 'You save $amount';
  }

  @override
  String get promoNotAvailable => 'That item is not available near you right now.';

  @override
  String bannerCountLabel(int index, int total) {
    return 'Offer $index of $total';
  }
}
