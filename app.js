
class HotelBookingEngine {
    constructor() {
    
        this.apiEndpoint = 'https://airbnb19.p.rapidapi.com/api/v2/searchPropertyByPlaceId';
        
        
        this.rapidApiKey = "440b45a61cmsh39bc0921a6636a1p15f38ajsnb53766a1dc0f"; 
        this.rapidApiHost = "airbnb19.p.rapidapi.com";

        
        this.defaultParams = {
    adults: "1",
    guestFavorite: "false",
    ib: "false",
    currency: "USD"
};

        
        this.processedHotels = [];
        this.currentMaxPriceFilter = Infinity;

        this.dom = {
            searchForm: document.getElementById("hotelSearchForm"),
            destinationInput: document.getElementById("destination"),
            checkInInput: document.getElementById("checkInDate"),
            checkOutInput: document.getElementById("checkOutDate"),
            guestsInput: document.getElementById("guestsRooms"),
            listingGrid: document.getElementById("hotelListingGrid"),
            resultsCount: document.getElementById("resultsCount"),
            locationBadge: document.getElementById("locationBadge"),
            sortSelect: document.getElementById("sortSelect"),
            priceSlider: document.getElementById("priceRangeSlider"),
            priceMinLabel: document.getElementById("priceRangeMin"),
            priceMaxLabel: document.getElementById("priceRangeMax"),
            priceCurrentLabel: document.getElementById("priceRangeCurrent"),
            amenitiesBox: document.getElementById("amenitiesContainer"),
            clearFiltersBtn: document.getElementById("clearFiltersBtn"),
            alertBox: document.getElementById("statusMessageAlertContainer"),
            modalTitle: document.getElementById("modalHotelTitle"),
            modalBody: document.getElementById("modalMainBodyContent"),
            modalFooterPrice: document.getElementById("modalFinalFooterPrice")
        };

        this.initEvents()

this.renderEmptyListingState(
    "Search Hotels",
    "Enter a destination Place ID and click Search."
);
    }

    initEvents() {
        if (this.dom.searchForm) {
            this.dom.searchForm.addEventListener("submit", (e) => this.handleSearchSubmit(e));
        }
        if (this.dom.sortSelect) {
            this.dom.sortSelect.addEventListener("change", () => this.applyFiltersAndSortRender());
        }
        if (this.dom.priceSlider) {
            this.dom.priceSlider.addEventListener("input", (e) => this.handlePriceSliderAdjustment(e));
        }
        if (this.dom.clearFiltersBtn) {
            this.dom.clearFiltersBtn.addEventListener("click", () => this.resetFiltersMachine());
        }
    }

    
    async fetchFromLiveApi(customQueryParams = {}) {
        this.renderLoadingSkeletons();
        this.toggleWidgetControlsState(false);
        this.clearAlertBanner();

        
        const fullyAssembledParams = Object.assign({}, this.defaultParams, customQueryParams);

        try {
            const queryUrlString =
`${this.apiEndpoint}?${new URLSearchParams(fullyAssembledParams)}`;
            
            const response = await fetch(queryUrlString, {
                method: "GET",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "X-RapidAPI-Key": this.rapidApiKey,
                    "X-RapidAPI-Host": this.rapidApiHost
                }
            });

            if (!response.ok) {
                throw new Error(`RapidAPI Gateway rejected request query sequence: HTTP status state [${response.status}]`);
            }

            const parsedPayloadPacket = await response.json();
            this.consumeStructuredPayload(parsedPayloadPacket);

        } catch (error) {
            this.showAlert("Live Synchronization Interrupted", error.message, "danger");
            this.renderEmptyListingState("API Error Handler Tripped", "Unable to stream properties results matches. Verify credit quotas or auth subscription parameters values settings inside code block configuration.");
            this.toggleWidgetControlsState(false);
        }
    }

    consumeStructuredPayload(jsonResponsePacket) {
        if (!jsonResponsePacket || !jsonResponsePacket.status || !jsonResponsePacket.data) {
            this.showAlert("Data Structuring Fault", "Incoming body properties mapping verification dropped.", "danger");
            this.renderEmptyListingState("Structural Incompatibility Error", "Verify destination payload schemas inside data nodes stream loops tracking.");
            return;
        }

      
        this.processedHotels = this.mapSchemaToApplicationStructure(jsonResponsePacket.data.list || []);
        
        this.buildDynamicSidebarFilters(jsonResponsePacket.data.filters);
        
        
        this.applyFiltersAndSortRender();
        this.toggleWidgetControlsState(true);
    }

    mapSchemaToApplicationStructure(apiListItems) {
        return apiListItems.map(item => {
            const uid = item.listing?.id || Math.random().toString(36).substring(2, 11);
            const title = item.title || "Premium Stay Travel Accommodation";
            const locationCity =
    item.demandStayListing?.location?.city ||
    item.demandStayListing?.location?.address ||
    "Unknown Location";
            
            let ratingValue = 0.0;
            if (item.avgRatingLocalized) {
                const token = parseFloat(item.avgRatingLocalized.split(' ')[0]);
                ratingValue = isNaN(token) ? 5.0 : token;
            }

            
            let priceInt = 120; 
            try {
                const prRef = item.structuredDisplayPrice;
                if (prRef?.primaryLine?.price) {
                    priceInt = parseInt(prRef.primaryLine.price.replace(/[^0-9]/g, ''), 10);
                } else if (prRef?.primaryLine?.discountedPrice) {
                    priceInt = parseInt(prRef.primaryLine.discountedPrice.replace(/[^0-9]/g, ''), 10);
                } else if (prRef?.explanationData?.priceDetails?.[0]?.items?.[0]?.priceString) {
                    priceInt = parseInt(prRef.explanationData.priceDetails[0].items[0].priceString.replace(/[^0-9]/g, ''), 10);
                }
            } catch { priceInt = 150; }

            let targetImagesList = [];
            if (item.contextualPictures && item.contextualPictures.length > 0) {
                targetImagesList = item.contextualPictures.map(p => p.picture);
            } else {
                targetImagesList = ["https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80"];
            }

            return {
                id: uid,
                hotelName: title,
                cityName: locationCity,
                ratingScore: ratingValue,
                ratingLabelString: item.avgRatingLocalized || "New Accommodation Option",
                totalCostEstimation: priceInt,
                currencyCode: "USD",
                badgeOverlayText: (item.badges && item.badges.length > 0) ? item.badges[0].text : "",
                imagesList: targetImagesList,
                originRef: item
            };
        });
    }

    handleSearchSubmit(event) {
    event.preventDefault();

    const destination = this.dom.destinationInput?.value.trim();

    if (!destination) {
        this.showAlert(
            "Destination Required",
            "Please enter a valid Place ID.",
            "warning"
        );
        return;
    }

    const searchParams = {
        placeId: destination,
        adults: this.dom.guestsInput?.value.split("-")[0] || "1",
        guestFavorite: "false",
        ib: "false",
        currency: "USD"
    };

    if (this.dom.locationBadge) {
        this.dom.locationBadge.innerText =
            `Searching: ${destination}`;
        this.dom.locationBadge.classList.remove("d-none");
    }

    this.fetchFromLiveApi(searchParams);
}

    buildDynamicSidebarFilters(filtersMetadata) {
        if (!filtersMetadata) return;

        if (filtersMetadata.priceR) {
            const min = filtersMetadata.priceR.priceMin || 0;
            const max = filtersMetadata.priceR.priceMax || 5000;
            
            this.currentMaxPriceFilter = max;

            if (this.dom.priceSlider) {
                this.dom.priceSlider.min = min;
                this.dom.priceSlider.max = max;
                this.dom.priceSlider.value = max;
            }

            if (this.dom.priceMinLabel) this.dom.priceMinLabel.innerText = `$${min}`;
            if (this.dom.priceMaxLabel) this.dom.priceMaxLabel.innerText = `$${max}`;
            if (this.dom.priceCurrentLabel) this.dom.priceCurrentLabel.innerText = `$${max.toLocaleString()}`;
        }

        if (this.dom.amenitiesBox && filtersMetadata.amenities) {
            this.dom.amenitiesBox.innerHTML = "";
            filtersMetadata.amenities.slice(0, 8).forEach((amenity, idx) => {
                const div = document.createElement("div");
                div.className = "form-check mb-2 text-dark";
                div.innerHTML = `
                    <input class="form-check-input inline-amenity-node-checkbox" type="checkbox" value="${amenity.title}" id="amenity_${idx}">
                    <label class="form-check-label small user-select-none" for="amenity_${idx}">${amenity.title}</label>
                `;
                this.dom.amenitiesBox.appendChild(div);
            });
        }
    }

    applyFiltersAndSortRender() {
        const sortStrategy = this.dom.sortSelect?.value || "default";

        let filteredListBuffer = this.processedHotels.filter(hotel => {
            return hotel.totalCostEstimation <= this.currentMaxPriceFilter;
        });

        if (sortStrategy === "price-asc") {
            filteredListBuffer.sort((a, b) => a.totalCostEstimation - b.totalCostEstimation);
        } else if (sortStrategy === "price-desc") {
            filteredListBuffer.sort((a, b) => b.totalCostEstimation - a.totalCostEstimation);
        } else if (sortStrategy === "rating-desc") {
            filteredListBuffer.sort((a, b) => b.ratingScore - a.ratingScore);
        }

        this.renderInterfaceGridViewCards(filteredListBuffer);
    }

    renderInterfaceGridViewCards(hotelsArray) {
        if (!this.dom.listingGrid) return;
        this.dom.listingGrid.innerHTML = "";

        if (this.dom.resultsCount) {
            this.dom.resultsCount.innerText = `Matched Live Stays Mapped: (${hotelsArray.length} Luxury Properties Displayed)`;
        }

        if (hotelsArray.length === 0) {
            this.renderEmptyListingState("No Budget-Compliant Matches", "Try raising your price ceilings parameters sliders context upwards.");
            return;
        }

        hotelsArray.forEach(hotel => {
            const cardCol = document.createElement("div");
            cardCol.className = "col-12";

            const badgeTag = hotel.badgeOverlayText ? `<span class="badge bg-dark badge-overlay text-uppercase py-2 px-3">${hotel.badgeOverlayText}</span>` : '';

            cardCol.innerHTML = `
                <div class="card hotel-card shadow-sm h-100 border">
                    <div class="row g-0">
                        <div class="col-md-4">
                            <div class="hotel-img-wrapper">
                                ${badgeTag}
                                <img src="${hotel.imagesList[0]}" class="hotel-card-img" alt="Hotel Visual Capture Image Asset" onerror="this.src='https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80'">
                            </div>
                        </div>
                        <div class="col-md-8 d-flex flex-column">
                            <div class="card-body p-4 flex-grow-1">
                                <div class="d-flex justify-content-between align-items-start mb-2">
                                    <h5 class="card-title fw-bold mb-0 text-dark text-capitalize">${hotel.hotelName}</h5>
                                    <span class="badge rating-star-pill d-flex align-items-center gap-1 py-2 px-2">
                                        <i class="fa-solid fa-star"></i> ${hotel.ratingLabelString.split(' ')[0]}
                                    </span>
                                </div>
                               <p class="text-muted mb-2 small">
    <i class="fa-solid fa-map-location-dot me-2 text-secondary"></i>
    ${hotel.cityName}
</p>
                                <div class="mt-3 d-flex flex-wrap gap-1">
                                    <span class="badge bg-light text-secondary border small"><i class="fa-solid fa-square-poll-vertical text-success me-1"></i> Live Realtime Verified Pricing Transaction Rate</span>
                                </div>
                            </div>
                            <div class="card-footer bg-white border-top-0 p-4 pt-0 d-flex justify-content-between align-items-center">
                                <div>
                                    <small class="text-muted d-block small">Aggregated Dynamic Total Base Cost Estimate</small>
                                    <span class="fs-4 fw-bold text-success">$${hotel.totalCostEstimation.toLocaleString()}</span> <small class="text-uppercase fw-bold text-muted">${hotel.currencyCode}</small>
                                </div>
                                <button class="btn btn-dark fw-bold px-4" id="btn_modal_trigger_link_${hotel.id}">View Stay Details <i class="fa-solid fa-arrow-right ms-2 small"></i></button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            this.dom.listingGrid.appendChild(cardCol);

            document.getElementById(`btn_modal_trigger_link_${hotel.id}`).addEventListener("click", () => this.launchDetailsViewModalWindow(hotel.id));
        });
    }

    launchDetailsViewModalWindow(hotelIdKey) {
        const hotel = this.processedHotels.find(h => h.id === hotelIdKey);
        if (!hotel) return;
        this.selectedHotel = hotel;

        if (this.dom.modalTitle) this.dom.modalTitle.innerText = hotel.hotelName;
        if (this.dom.modalFooterPrice) this.dom.modalFooterPrice.innerText = `$${hotel.totalCostEstimation.toLocaleString()} ${hotel.currencyCode}`;

        let itemizedDetailsHTML = "";
        if (hotel.originRef.structuredDisplayPrice?.explanationData?.priceDetails) {
            hotel.originRef.structuredDisplayPrice.explanationData.priceDetails.forEach(grp => {
                if (grp.items) {
                    grp.items.forEach(lineItem => {
                        itemizedDetailsHTML += `
                            <div class="d-flex justify-content-between align-items-center mb-2 small border-bottom pb-1">
                                <span class="text-muted text-sm"><i class="fa-solid fa-circle-info text-primary me-2 small"></i>${lineItem.description}</span>
                                <span class="fw-bold text-dark">${lineItem.priceString}</span>
                            </div>
                        `;
                    });
                }
            });
        }

        let inlineThumbnailsStripHTML = "";
        hotel.imagesList.forEach((src, index) => {
            inlineThumbnailsStripHTML += `
                <div class="col-4 col-sm-2">
                    <img src="${src}" class="img-fluid gallery-thumbnail border" alt="Thumb" onclick="document.getElementById('modalMainHeroImg').src='${src}'">
                </div>
            `;
        });

        if (this.dom.modalBody) {
            this.dom.modalBody.innerHTML = `
                <div class="bg-secondary position-relative" style="height: 280px; overflow: hidden;">
                    <img id="modalMainHeroImg" src="${hotel.imagesList[0]}" class="w-100 h-100 object-fit-cover" alt="Hero Background Preview">
                </div>
                <div class="p-4">
                    <div class="row g-2 mb-4 justify-content-start">${inlineThumbnailsStripHTML}</div>
                    <div class="row g-4">
                        <div class="col-md-7">
                            <h6 class="fw-bold text-uppercase text-muted tracking-wider small mb-2">Live Production Mapping Engine Profile Data</h6>
                            <p class="text-secondary small lh-lg">
                                This properties configuration unit references live verification stream vectors components from endpoint cluster nodes located inside localized travel sectors segments grids. Fully integrated with automated component parameters verification matching validation systems requirements definitions metrics bounds templates execution cycles maps.
                            </p>
                            <div class="mt-4 p-3 bg-white rounded border">
                                <span class="d-block small text-muted mb-2 fw-semibold">Live Integration System Identity Hash String Value</span>
                                <code class="text-xs text-break bg-light p-2 rounded d-block text-danger">${hotel.id}</code>
                            </div>
                        </div>
                        <div class="col-md-5">
                            <div class="card bg-light border-0 p-3 rounded-3 shadow-xs">
                                <h6 class="fw-bold mb-3 text-dark"><i class="fa-solid fa-receipt me-2 text-secondary"></i>Itemized Transaction Invoice</h6>
                                <div class="mb-3">${itemizedDetailsHTML || 'No separate service fee lines returned by server array profiles rules.'}</div>
                                <div class="d-flex justify-content-between align-items-center fw-bold text-dark pt-2 border-top">
                                    <span class="small text-uppercase">Total Cost Estimate</span>
                                    <span class="text-success fs-5">$${hotel.totalCostEstimation.toLocaleString()} USD</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        const modalWidgetBootstrapInstance = new bootstrap.Modal(document.getElementById('hotelDetailsModal'));
        modalWidgetBootstrapInstance.show();
    }

    handlePriceSliderAdjustment(e) {
        const val = parseInt(e.target.value, 10);
        this.currentMaxPriceFilter = val;
        if (this.dom.priceCurrentLabel) this.dom.priceCurrentLabel.innerText = `$${val.toLocaleString()}`;
        this.applyFiltersAndSortRender();
    }

    resetFiltersMachine() {
        if (this.dom.sortSelect) this.dom.sortSelect.value = "default";
        if (this.dom.priceSlider) {
            const maximumLimit = parseInt(this.dom.priceSlider.max, 10) || 5000;
            this.currentMaxPriceFilter = maximumLimit;
            this.dom.priceSlider.value = maximumLimit;
            if (this.dom.priceCurrentLabel) this.dom.priceCurrentLabel.innerText = `$${maximumLimit.toLocaleString()}`;
        }
        this.applyFiltersAndSortRender();
    }

    toggleWidgetControlsState(isEnabled = false) {
        if (this.dom.sortSelect) this.dom.sortSelect.disabled = !isEnabled;
        if (this.dom.priceSlider) this.dom.priceSlider.disabled = !isEnabled;
        if (this.dom.clearFiltersBtn) this.dom.clearFiltersBtn.disabled = !isEnabled;
    }

    showAlert(title, message, theme = "danger") {
        if (!this.dom.alertBox) return;
        this.dom.alertBox.innerHTML = `
            <div class="alert alert-${theme} alert-dismissible shadow-sm fade show" role="alert">
                <i class="fa-solid fa-circle-exclamation me-2"></i><strong>${title}:</strong> ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
    }

    clearAlertBanner() { if (this.dom.alertBox) this.dom.alertBox.innerHTML = ""; }

    renderEmptyListingState(title, message) {
        if (!this.dom.listingGrid) return;
        this.dom.listingGrid.innerHTML = `
            <div class="col-12 text-center py-5 bg-white border rounded shadow-sm text-muted">
                <i class="fa-solid fa-folder-open display-4 mb-2 opacity-50 text-secondary"></i>
                <h6>${title}</h6><p class="small mb-0">${message}</p>
            </div>
        `;
    }

    renderLoadingSkeletons() {
        if (!this.dom.listingGrid) return;
        this.dom.listingGrid.innerHTML = "";
        for (let i = 0; i < 3; i++) {
            const div = document.createElement("div");
            div.className = "col-12";
            div.innerHTML = `
                <div class="card hotel-card placeholder-glow shadow-xs" aria-hidden="true">
                    <div class="row g-0">
                        <div class="col-md-4 bg-secondary placeholder opacity-25" style="min-height: 200px;"></div>
                        <div class="col-md-8 card-body p-4 d-flex flex-column justify-content-between">
                            <div>
                                <span class="placeholder col-7 bg-secondary opacity-50 mb-3 d-block rounded-1"></span>
                                <span class="placeholder col-4 bg-secondary opacity-25 mb-1 d-block rounded-1"></span>
                            </div>
                            <div class="d-flex justify-content-between align-items-center mt-4">
                                <span class="placeholder col-3 bg-success opacity-50 h-50 rounded-1"></span>
                                <span class="placeholder col-2 bg-dark opacity-75 h-50 rounded-1"></span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            this.dom.listingGrid.appendChild(div);
        }
    }

    showBookingForm() {

    this.dom.modalBody.innerHTML = `
    <div class="container p-4">
        <h4 class="mb-4">Guest Details</h4>

        <div class="row g-3">

            <div class="col-md-6">
                <label class="form-label">Full Name</label>
                <input type="text"
                       class="form-control"
                       id="guestName">
            </div>

            <div class="col-md-6">
                <label class="form-label">Email</label>
                <input type="email"
                       class="form-control"
                       id="guestEmail">
            </div>

            <div class="col-md-6">
                <label class="form-label">Phone</label>
                <input type="tel"
                       class="form-control"
                       id="guestPhone">
            </div>

            <div class="col-md-6">
                <label class="form-label">Address</label>
                <input type="text"
                       class="form-control"
                       id="guestAddress">
            </div>

        </div>

        <div class="text-end mt-4">
            <button class="btn btn-primary"
                    onclick="StayBookerAppInstance.showPaymentForm()">
                Continue To Payment
            </button>
        </div>

    </div>
    `;
}

showPaymentForm() {

    const guestData = {
    name: document.getElementById("guestName")?.value.trim(),
    email: document.getElementById("guestEmail")?.value.trim(),
    phone: document.getElementById("guestPhone")?.value.trim(),
    address: document.getElementById("guestAddress")?.value.trim()
};

if (
    !guestData.name ||
    !guestData.email ||
    !guestData.phone
) {
    alert("Please fill all guest details.");
    return;
}

    localStorage.setItem(
        "guestData",
        JSON.stringify(guestData)
    );

    this.dom.modalBody.innerHTML = `
    <div class="container p-4">

        <h4 class="mb-4">Payment Details</h4>

        <div class="mb-3">
            <label class="form-label">Card Holder Name</label>
            <input type="text"
                   class="form-control"
                   id="cardName">
        </div>

        <div class="mb-3">
            <label class="form-label">Card Number</label>
            <input type="text"
                   class="form-control"
                   id="cardNumber"
                   maxlength="16">
        </div>

        <div class="row">

            <div class="col-md-6">
                <label class="form-label">Expiry</label>
                <input type="month"
                       class="form-control"
                       id="expiry">
            </div>

            <div class="col-md-6">
                <label class="form-label">CVV</label>
                <input type="password"
                       class="form-control"
                       id="cvv"
                       maxlength="3">
            </div>

        </div>

        <div class="text-end mt-4">
            <button class="btn btn-success"
                    onclick="StayBookerAppInstance.confirmBooking()">
                Pay Now
            </button>
        </div>

    </div>
    `;
}

confirmBooking() {

    const bookingId =
        "BK" +
        Math.floor(Math.random() * 1000000);

    const guest =
        JSON.parse(
            localStorage.getItem("guestData")
        );

    const hotel =
        this.selectedHotel;

    this.dom.modalTitle.innerText =
        "Booking Confirmation";

    this.dom.modalFooterPrice.innerText =
        "PAID";

    this.dom.modalBody.innerHTML = `
    <div class="container p-5 text-center">

        <i class="fa-solid fa-circle-check
                  text-success
                  display-1"></i>

        <h2 class="mt-3">
            Booking Confirmed
        </h2>

        <p class="lead">
            Thank you for choosing StayBooker
        </p>

        <hr>

        <h5>Booking ID</h5>

        <h3 class="text-primary">
            ${bookingId}
        </h3>

        <div class="card mt-4">
            <div class="card-body text-start">

                <h5 class="mb-3">
                    Guest Information
                </h5>

                <p>
                    <strong>Name:</strong>
                    ${guest.name}
                </p>

                <p>
                    <strong>Email:</strong>
                    ${guest.email}
                </p>

                <p>
                    <strong>Phone:</strong>
                    ${guest.phone}
                </p>

                <p>
                    <strong>Address:</strong>
                    ${guest.address}
                </p>

                <hr>

                <h5 class="mb-3">
                    Hotel Information
                </h5>

                <p>
                    <strong>Hotel:</strong>
                    ${hotel.hotelName}
                </p>

                <p>
                    <strong>Location:</strong>
                    ${hotel.cityName}
                </p>

                <p>
                    <strong>Total Price:</strong>
                    $${hotel.totalCostEstimation}
                </p>

            </div>
        </div>

    </div>
    `;
}
}



document.addEventListener("DOMContentLoaded", () => {
    window.StayBookerAppInstance = new HotelBookingEngine();
});