﻿using System;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.Linq;
using System.Web;
using VORBS.DAL.Repositories;
using VORBS.Models;

namespace VORBS.Services
{
    public class RoomService
    {
        NLog.Logger _logger;
        ILocationRepository _locationRepository;
        IRoomRepository _roomRepository;
        IBookingRepository _bookingRepository;
        IDirectoryService _directoryService;

        public RoomService(NLog.Logger logger, ILocationRepository locationRepository, IRoomRepository roomRepository, IBookingRepository bookingRepository, IDirectoryService directoryService)
        {
            _logger = logger;
            _locationRepository = locationRepository;
            _roomRepository = roomRepository;
            _bookingRepository = bookingRepository;
            _directoryService = directoryService;
        }

        public void EditRoom(Room existingRoom, Room editRoom)
        {
            Location location = _locationRepository.GetLocationById(existingRoom.LocationID);

            if (existingRoom.RoomName != editRoom.RoomName)
            {
                bool isDuplicate = _roomRepository.GetByLocationAndName(location, editRoom.RoomName) != null;

                if (isDuplicate)
                    throw new RoomExistsException();
            }

            editRoom.LocationID = existingRoom.LocationID;

            _roomRepository.EditRoom(editRoom);
            _logger.Info("Room successfully Edited: " + editRoom.ID);
        }

        public void ToggleRoomActive(Room room, bool active, NameValueCollection appSettings)
        {
            room.Active = active;
            _roomRepository.EditRoom(room);

            if (!active)
            {
                List<Booking> bookings = _bookingRepository.GetByDateAndRoom(DateTime.Now, room)
                                                    .OrderBy(b => b.Owner)
                                                    .ToList();
                _bookingRepository.Delete(bookings);

                string fromEmail = appSettings["fromEmail"];

                if (bookings.Count() > 0)
                {
                    List<Booking> ownerBookings = new List<Booking>();

                    string currentOwner = bookings[0].Owner;
                    
                    //Iterate around each booking until we hit a new subset belonging to a different owner. Then email that batch.
                    foreach (var booking in bookings)
                    {
                        if (booking.Owner != currentOwner)
                        {
                            SendEmailToOwnerForMultiDelete(fromEmail, ownerBookings);

                            ownerBookings = new List<Booking>();
                            currentOwner = booking.Owner;
                        }

                        ownerBookings.Add(booking);
                    }

                    //Final Send the last owner bookings
                    SendEmailToOwnerForMultiDelete(fromEmail, ownerBookings);
                }
            }
        }

        private void SendEmailToOwnerForMultiDelete(string fromEmail, List<Booking> ownerBookings)
        {
            try
            {
                string toEmail = _directoryService.GetUser(new User.Pid(ownerBookings[0].PID)).EmailAddress;
                string body = Utils.EmailHelper.GetEmailMarkup("~/Views/EmailTemplates/AdminMultiCancelledBooking.cshtml", ownerBookings);

                if (!string.IsNullOrEmpty(body) && !string.IsNullOrEmpty(toEmail))
                    Utils.EmailHelper.SendEmail(fromEmail, toEmail, "Meeting room booking(s) cancellation", body);
                else
                    throw new Exception("Body or To-Email is null.");
            }
            catch (Exception ex)
            {
                _logger.ErrorException("Unable to send admin multiple bookings email.", ex);
            }
        }

        public class RoomExistsException : Exception { }
    }
}