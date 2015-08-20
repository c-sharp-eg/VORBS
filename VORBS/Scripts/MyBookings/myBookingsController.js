﻿myBookings.controller('MyBookingsController', ['$scope', '$http', '$resource', MyBookingsController]);

function MyBookingsController($scope, $http, $resource) {

    CreateServices($resource);

    $scope.orderByField = 'date';
    $scope.reverseSort = false;

    $scope.locations = Locations.query({ status: true, extraInfo: false });
    $scope.bookingFilter = {
        location: { name: '', id: 0 },
        room: '',
        startDate: '',
        smartRoom: false
    };

    $scope.SearchBookings = function () {
        $scope.bookings = FilterBookings.query({
            locationId: $scope.bookingFilter.location.id,
            room: $scope.bookingFilter.room,
            startDate: FormatDateTimeForURL($scope.bookingFilter.startDate, 'MM-DD-YYYY', false, false),
            smartRoom: $scope.bookingFilter.smartRoom
        });
    }

    $scope.externalFullNameTextBox = '';
    $scope.externalCompanyNameTextBox = '';
    $scope.externalPassRequired = false;

    $scope.GetBookings = function () {

        var period = 7;
        period = (5 - new moment().utc().days()) + 1;

        $scope.bookings = BookingsByPeriod.query({
            startDate: new moment().utc().format("MM-DD-YYYY-HHmm"),
            period: period
        });
    }

    $scope.GetBookings();

    $scope.bookingId = 0;

    $scope.SetBookingId = function (id) {
        $scope.bookingId = id;
    }

    $scope.AddExternalAttendee = function () {
        SetModalErrorMessage('');
        $scope.booking.externalAttendees = AddExternalName($scope.booking.externalAttendees);
        $scope.externalFullNameTextBox = '';
        $scope.externalCompanyNameTextBox = '';
        $scope.externalPassRequired = false;
    }

    $scope.RemoveExternalAttendee = function (index) {
        SetModalErrorMessage('');
        $scope.booking.ExternalNames = RemoveExternalName(index, $scope.booking.externalAttendees);
    }

    $scope.LoadEditBooking = function (bookingId) {
        //Reset Any Error Messages
        SetModalErrorMessage('');
        ResetExternalNamesUI();
        SetEditActiveTab('editBooking');

        $scope.SetBookingId(bookingId);

        $scope.editBooking = Booking.query({
            bookingId: $scope.bookingId
        },
        function (sucess) {
            $scope.newBooking.Room.RoomName = $scope.editBooking.room.roomName.replace('_', '.');
            $scope.newBooking.Subject = $scope.editBooking.subject;
            $scope.newBooking.FlipChart = $scope.editBooking.flipchart;
            $scope.newBooking.Projector = $scope.editBooking.projector;
            $scope.newBooking.RoomID = $scope.editBooking.room.id;
            $scope.newBooking.IsSmartMeeting = $scope.editBooking.isSmartMeeting;

            if ($scope.editBooking.externalAttendees !== null) {
                //$scope.booking.externalAttendees = $scope.editBooking.externalNames.split(';');
                $scope.booking.externalAttendees = $scope.editBooking.externalAttendees;
            }
            else {
                $scope.booking.externalAttendees = []; //Reset External Name List
            }

            $scope.booking.numberOfAttendees = $scope.editBooking.numberOfAttendees;
            $scope.booking.startTime = FormatTimeDate($scope.editBooking.startDate, false);
            $scope.booking.endTime = FormatTimeDate($scope.editBooking.endDate, false);
            $scope.booking.date = FormatTimeDate($scope.editBooking.startDate, true);

            //Store the vital existing booking data
            $scope.existingBooking.numberOfAttendees = $scope.booking.numberOfAttendees;
            $scope.existingBooking.startTime = $scope.booking.startTime;
            $scope.existingBooking.endTime = $scope.booking.endTime;
            $scope.existingBooking.date = $scope.booking.date;


            //Uncomment this to enable DSS checks when we have DSS support for edit
            //if (!$scope.editBooking.room.smartRoom) {
            //    $("#dssAssistChoice").css('display', 'none');
            //} else {
            //    if (!GetLocationCredentialsFromList("dss", $scope.editBooking.room.location.locationCredentials)) {
            //        $("#dssAssistChoice").css('display', 'none');
            //        $("#dssAssistContWarning").css("display", "block");
            //    } else {
            //        $("#dssAssistChoice").css('display', 'block');
            //        $("#dssAssistContWarning").css("display", "none");
            //    }
            //}

            if (!GetLocationCredentialsFromList(securityCredentialsName, $scope.editBooking.location.locationCredentials)) {
                $("#externalAttendeesCont").css("display", "none");
                var message = "This location does not have a dedicated security desk.";
                var facilities = GetLocationCredentialsFromList(facilitiesCredentialsName, $scope.editBooking.location.locationCredentials);
                if (facilities) {
                    message = message + " Please contact the local facilities officer at " + facilities.email + " for visitory access protocols.";
                }
                $("#externalAttendeesContWarning").text(message);
                $("#externalAttendeesContWarning").css("display", "block");
            } else {
                $("#externalAttendeesCont").css("display", "block");
                $("#externalAttendeesContWarning").css("display", "none");
            }

            if (!GetLocationCredentialsFromList(facilitiesCredentialsName, $scope.editBooking.location.locationCredentials)) {
                $("#additionalEquipmentCont").css("display", "none");
                $("#additionalEquipmentContWarning").css("display", "block");
            } else {
                $("#additionalEquipmentCont").css("display", "block");
                $("#additionalEquipmentContWarning").css("display", "none");
            }
        }
      )
    }

    $scope.CheckEditBooking = function () {
        //Reset Any Error Messages
        SetModalErrorMessage('');

        //Validate Start Date
        if ($scope.booking.date === "") {
            SetModalErrorMessage('Invalid Date.');
            return;
        }

        //Validate Number of External Names is not graether than attendees
        ValidateNoAttendees($scope.editBooking.room.seatCount, $scope.booking.externalAttendees.length);
        $scope.newBooking.NumberOfAttendees = $scope.booking.numberOfAttendees;

        var unsavedAttendee = ValidateUnSavedAttendee();
        if (unsavedAttendee !== "") {
            SetModalErrorMessage(unsavedAttendee);
            return;
        }

        //Validate Times
        var timeValidation = ValidateStartEndTime($scope.booking.startTime, $scope.booking.endTime);
        if (timeValidation !== "") {
            SetModalErrorMessage(timeValidation);
            return;
        }

        //Change the "accept booking" button to stop multiple bookings
        $("#acceptBookingConfirmButton").prop('disabled', 'disabled');
        $("#acceptBookingConfirmButton").html('Editing Booking. Please wait..');

        try {
            //Create Date String
            $scope.newBooking.StartDate = FormatDateTimeForURL($scope.booking.date + ' ' + $scope.booking.startTime, 'MM-DD-YYYY-HHmm', true, true);
            $scope.newBooking.EndDate = FormatDateTimeForURL($scope.booking.date + ' ' + $scope.booking.endTime, 'MM-DD-YYYY-HHmm', true, true);

            if ($scope.booking.externalAttendees.length > 0) {
                $scope.newBooking.externalAttendees = $scope.booking.externalAttendees;//.join(';');
            }

            //Validate if Date/Time/Attendees has changed
            if (($scope.booking.numberOfAttendees === $scope.existingBooking.numberOfAttendees) && ($scope.booking.date === $scope.existingBooking.date) &&
                ($scope.booking.startTime === $scope.existingBooking.startTime) && ($scope.booking.endTime === $scope.existingBooking.endTime)) {
                SaveEditBooking($scope.bookingId, $scope.newBooking);
            }
            else {
                $scope.availableRooms = Available.query({
                    location: $scope.editBooking.location.name,
                    startDate: FormatDateTimeForURL($scope.booking.date + ' ' + $scope.booking.startTime, 'MM-DD-YYYY-HHmm', true, true),
                    endDate: FormatDateTimeForURL($scope.booking.date + ' ' + $scope.booking.endTime, 'MM-DD-YYYY-HHmm', true, true),
                    smartRoom: $scope.newBooking.IsSmartMeeting,
                    numberOfAttendees: $scope.booking.numberOfAttendees,
                    existingBookingId: $scope.bookingId
                },
                function (success) {
                    if ($scope.availableRooms.length === 0) {
                        EnableAcceptBookingButton();
                        SetModalErrorMessage('No Rooms Avaliable using the below Date/Time/Attendees.');
                    }
                    else if ($scope.availableRooms[0].roomName.replace('_', '.') === $scope.newBooking.Room.RoomName) {
                        SaveEditBooking($scope.bookingId, $scope.newBooking);
                    }
                    else {
                        EnableAcceptBookingButton();
                        SetEditActiveTab('confirmEditBooking');
                        $scope.currentRoom = $scope.availableRooms[0];
                    }
                },
                function (error) {
                    EnableAcceptBookingButton();
                    alert('Unable to Edit. Please Try Again or Contact ITSD. ' + error.message);
                });
            }

        } catch (e) {
            EnableAcceptBookingButton();
        }
    }

    $scope.EditBooking = function () {
        //Change the "accept booking" button to stop multiple bookings
        $("#confirmBookingConfirmButton").prop('disabled', 'disabled');
        $("#confirmBookingConfirmButton").html('Editing Booking. Please wait..');

        $scope.newBooking.RoomID = $scope.currentRoom.id;
        SaveEditBooking($scope.bookingId, $scope.newBooking);

        EnableConfirmBookingButton();
    }

    $scope.DeleteBooking = function () {
        //Change the "delete booking" button to stop multiple bookings
        $("#deleteBookingConfirmButton").prop('disabled', 'disabled');
        $("#deleteBookingConfirmButton").html('Deleteing Booking. Please wait..');

        try {
            Booking.remove(
            {
                bookingId: $scope.bookingId
            },
            function (success) {
                $("#deleteModal").modal('hide');
                $scope.GetBookings();
                EnableDeleteBookingButton();
            },
            function (error) {
                alert('Unable to Delete Booking. Please Try Again or Contact ITSD. ' + error.message);
                EnableDeleteBookingButton();
            });

        } catch (e) {
            EnableDeleteBookingButton();
        }
    }

    $scope.FormatPassRequired = function (required) {
        if (required) {
            return "Yes";
        }
        else {
            return "No";
        }
    }

    $scope.newBooking = {
        Room: { RoomName: '' },
        Subject: '',
        NumberOfAttendees: 0,
        RoomID: 0,
        ExternalNames: null,
        StartDate: new Date(),
        EndDate: new Date(),
        FlipChart: false,
        Projector: false,
        IsSmartMeeting: false
    };

    $scope.booking = {
        startTime: '',
        endTime: '',
        date: new Date(),
        numberOfAttendees: 0,
        externalAttendees: []
    }

    $scope.existingBooking = {
        startTime: '',
        endTime: '',
        date: new Date(),
        numberOfAttendees: 0
    }
}


function CreateServices($resource) {

    Locations = $resource('/api/locations/:status/:extraInfo', {
        status: 'active', extraInfo: 'extraInfo'
    }, {
        query: { method: 'GET', isArray: true }
    });

    Available = $resource('/api/availability/:location/:startDate/:endDate/:numberOfAttendees/:smartRoom/:existingBookingId', {
        location: 'location', startDate: 'startDate', endDate: 'endDate', numberOfAttendees: 'numberOfAttendees', smartRoom: 'smartRoom', existingBookingId: 'existingBookingId'
    },
    {
        query: { method: 'GET', isArray: true }
    });

    Available.prototype = {
        roomNameFormatted: function () { return this.roomName.replace('_', '.'); }
    };

    Bookings = $resource('/api/bookings/:startDate/:person', { startDate: 'startDate', person: 'person' },
    {
        query: { method: 'GET', isArray: true }
    });

    Bookings.prototype = {
        DateFormatted: function () { return moment(this.startDate).format("DD/MM/YYYY"); },
        startTimeFormatted: function () { return moment(this.startDate).format("H:mm"); },
        endTimeFormatted: function () { return moment(this.endDate).format("H:mm"); },
        roomNameFormatted: function () { return this.room.roomName.replace('_', '.'); }
    };

    Booking = $resource('/api/bookings/:bookingId', { bookingId: 'bookingId' },
    {
        query: { method: 'GET' },
        remove: { method: 'DELETE' }
    });


    BookingsByPeriod = $resource('/api/bookings/:startDate/:period', { startDate: '', period: 7 },
    {
        query: { method: 'GET', isArray: true },
        remove: { method: 'DELETE' }
    });

    BookingsByPeriod.prototype = {
        DateFormatted: function () { return moment(this.startDate).format("DD/MM/YYYY"); },
        startTimeFormatted: function () { return moment(this.startDate).format("H:mm"); },
        endTimeFormatted: function () { return moment(this.endDate).format("H:mm"); },
        roomNameFormatted: function () { return this.room.roomName.replace('_', '.'); }
    };

    FilterBookings = $resource('/api/bookings/search', {}, {
        query: { method: 'GET', isArray: true }
    });
    FilterBookings.prototype = {
        DateFormatted: function () { return moment(this.startDate).format("DD/MM/YYYY"); },
        startTimeFormatted: function () { return moment(this.startDate).format("H:mm"); },
        endTimeFormatted: function () { return moment(this.endDate).format("H:mm"); },
        roomNameFormatted: function () { return this.room.roomName.replace('_', '.'); }
    };
}